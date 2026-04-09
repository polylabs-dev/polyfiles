use estream_test::{
    Journey, JourneyParty, JourneyStep, StepAction, JourneyMetrics,
    assert_metric_emitted, assert_blinded, assert_povc_witness,
};
use estream_test::convoy::{ConvoyContext, ConvoyResult};
use estream_test::stratum::{StratumVerifier, CsrTier, SeriesMerkleChain};
use estream_test::cortex::{CortexVisibility, RedactPolicy, ObfuscatePolicy};
use estream_test::scatter_cas::{ScatterStore, ErasureConfig};

pub struct PolyfilesJourney;

impl Journey for PolyfilesJourney {
    fn name(&self) -> &str {
        "qfiles_e2e"
    }

    fn description(&self) -> &str {
        "End-to-end journey for Polyfiles: upload, share, provenance, revoke, scatter-cas verification"
    }

    fn parties(&self) -> Vec<JourneyParty> {
        vec![
            JourneyParty::new("alice")
                .with_spark_context("q-files-v1")
                .with_role("owner"),
            JourneyParty::new("bob")
                .with_spark_context("q-files-v1")
                .with_role("recipient"),
            JourneyParty::new("charlie")
                .with_spark_context("q-files-v1")
                .with_role("auditor"),
        ]
    }

    fn steps(&self) -> Vec<JourneyStep> {
        vec![
            // Step 1: Alice uploads a file to scatter-cas
            JourneyStep::new("alice_uploads_file")
                .party("alice")
                .action(StepAction::Execute(|ctx: &mut ConvoyContext| {
                    let file_content = ctx.generate_test_payload(1024 * 64); // 64 KiB
                    let upload_result = ctx.qfiles().upload(
                        "quarterly-report.pdf",
                        &file_content,
                        ErasureConfig::new(3, 5), // k=3, n=5
                    )?;

                    ctx.set("file_cid", &upload_result.cid);
                    ctx.set("file_manifest", &upload_result.manifest_id);

                    assert!(upload_result.scatter_shards >= 5);
                    assert!(upload_result.cid.starts_with("bafk"));

                    assert_metric_emitted!(ctx, "qfiles.upload.complete", {
                        "shard_count" => "5",
                        "erasure_k" => "3",
                    });

                    assert_povc_witness!(ctx, "qfiles.upload", {
                        witness_type: "scatter_store",
                        cid: &upload_result.cid,
                    });

                    Ok(())
                }))
                .timeout_ms(10_000),

            // Step 2: Bob receives a share link and accesses the file
            JourneyStep::new("bob_receives_share")
                .party("bob")
                .depends_on(&["alice_uploads_file"])
                .action(StepAction::Execute(|ctx: &mut ConvoyContext| {
                    let file_cid = ctx.get::<String>("file_cid");
                    let alice_id = ctx.party_id("alice");

                    let share = ctx.qfiles().accept_share(
                        &alice_id,
                        &file_cid,
                        &["read"],
                    )?;

                    assert!(share.access_granted);
                    assert_eq!(share.permissions, vec!["read"]);

                    let downloaded = ctx.qfiles().download(&file_cid)?;
                    assert_eq!(downloaded.len(), 1024 * 64);

                    assert_metric_emitted!(ctx, "qfiles.share.accepted", {
                        "permission_level" => "read",
                    });

                    assert_blinded!(ctx, "qfiles.share.accepted", {
                        field: "recipient_id",
                        blinding: "hmac_sha3",
                    });

                    Ok(())
                }))
                .timeout_ms(10_000),

            // Step 3: Charlie verifies file provenance via PoVC witness chain
            JourneyStep::new("charlie_verifies_provenance")
                .party("charlie")
                .depends_on(&["bob_receives_share"])
                .action(StepAction::Execute(|ctx: &mut ConvoyContext| {
                    let file_cid = ctx.get::<String>("file_cid");

                    let provenance = ctx.qfiles().verify_provenance(&file_cid)?;

                    assert!(provenance.witness_chain_valid);
                    assert_eq!(provenance.origin_party_role, "owner");
                    assert!(provenance.chain_length >= 1);

                    for witness in &provenance.witnesses {
                        assert_povc_witness!(ctx, "qfiles.provenance", {
                            witness_type: "chain_link",
                            cid: &file_cid,
                            witness_id: &witness.id,
                        });
                    }

                    assert_blinded!(ctx, "qfiles.provenance.query", {
                        field: "auditor_id",
                        blinding: "hmac_sha3",
                    });

                    Ok(())
                }))
                .timeout_ms(8_000),

            // Step 4: Alice revokes Bob's share
            JourneyStep::new("alice_revokes_share")
                .party("alice")
                .depends_on(&["charlie_verifies_provenance"])
                .action(StepAction::Execute(|ctx: &mut ConvoyContext| {
                    let file_cid = ctx.get::<String>("file_cid");
                    let bob_id = ctx.party_id("bob");

                    let revoke_result = ctx.qfiles().revoke_share(
                        &file_cid,
                        &bob_id,
                    )?;

                    assert!(revoke_result.revoked);
                    assert!(revoke_result.re_keyed);

                    let bob_ctx = ctx.as_party("bob");
                    let access_attempt = bob_ctx.qfiles().download(&file_cid);
                    assert!(access_attempt.is_err());

                    assert_metric_emitted!(ctx, "qfiles.share.revoked", {
                        "re_keyed" => "true",
                    });

                    assert_povc_witness!(ctx, "qfiles.revoke", {
                        witness_type: "access_revocation",
                        cid: &file_cid,
                    });

                    Ok(())
                }))
                .timeout_ms(8_000),

            // Step 5: Verify scatter-cas storage integrity (Stratum tiers)
            JourneyStep::new("verify_scatter_cas_storage")
                .party("alice")
                .depends_on(&["alice_revokes_share"])
                .action(StepAction::Execute(|ctx: &mut ConvoyContext| {
                    let file_cid = ctx.get::<String>("file_cid");
                    let manifest_id = ctx.get::<String>("file_manifest");

                    let stratum = StratumVerifier::new(ctx);

                    let csr_report = stratum.verify_csr_tiers(&file_cid)?;
                    assert!(csr_report.tier_matches(CsrTier::Hot));
                    assert!(csr_report.shard_distribution_valid);
                    assert!(csr_report.erasure_recoverable);

                    let merkle = stratum.verify_series_merkle_chain(&manifest_id)?;
                    assert!(merkle.chain_intact);
                    assert!(merkle.root_hash_valid);
                    assert!(merkle.series_count >= 1);

                    assert_metric_emitted!(ctx, "qfiles.stratum.verified", {
                        "csr_tier" => "hot",
                        "chain_intact" => "true",
                    });

                    Ok(())
                }))
                .timeout_ms(12_000),

            // Step 6: Verify blind telemetry emission and Cortex visibility
            JourneyStep::new("verify_blind_telemetry")
                .party("alice")
                .depends_on(&["verify_scatter_cas_storage"])
                .action(StepAction::Execute(|ctx: &mut ConvoyContext| {
                    let telemetry = ctx.streamsight().drain_telemetry("q-files-v1");

                    for event in &telemetry {
                        assert_blinded!(ctx, &event.event_type, {
                            field: "user_id",
                            blinding: "hmac_sha3",
                        });

                        assert_blinded!(ctx, &event.event_type, {
                            field: "file_content",
                            blinding: "absent",
                        });
                    }

                    let cortex = CortexVisibility::new(ctx);
                    cortex.assert_redacted("qfiles", RedactPolicy::ContentFields)?;
                    cortex.assert_obfuscated("qfiles", ObfuscatePolicy::PartyIdentifiers)?;

                    assert!(telemetry.len() >= 5, "Expected at least 5 telemetry events");

                    let namespaces: Vec<&str> = telemetry
                        .iter()
                        .map(|e| e.namespace.as_str())
                        .collect();
                    for ns in &namespaces {
                        assert!(
                            ns.starts_with("q-files-v1"),
                            "Telemetry must stay within q-files-v1 namespace, found: {}",
                            ns
                        );
                    }

                    Ok(())
                }))
                .timeout_ms(5_000),
        ]
    }

    fn metrics(&self) -> JourneyMetrics {
        JourneyMetrics {
            expected_events: vec![
                "qfiles.upload.complete",
                "qfiles.share.accepted",
                "qfiles.provenance.query",
                "qfiles.share.revoked",
                "qfiles.stratum.verified",
            ],
            max_duration_ms: 60_000,
            required_povc_witnesses: 4,
            lex_namespace: "q-files-v1",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use estream_test::convoy::ConvoyRunner;

    #[tokio::test]
    async fn run_qfiles_journey() {
        let runner = ConvoyRunner::new()
            .with_scatter_cas()
            .with_streamsight("q-files-v1")
            .with_stratum()
            .with_cortex();

        runner.run(PolyfilesJourney).await.expect("Polyfiles journey failed");
    }
}
