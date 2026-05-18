-- pg_cron job: scheduled but inactive in P1 until Edge Function is deployed and
-- app.functions_url + app.service_role_key GUCs are configured.
-- Activation will be by an operator running: SELECT cron.alter_job(<id>, active := true);

-- For P1 we register the job in inactive state. The cron.schedule() returns a jobid;
-- the operator marks it active after Edge Function deploy.

DO $$
DECLARE
  v_jobid bigint;
  v_exists int;
BEGIN
  SELECT count(*) INTO v_exists FROM cron.job WHERE jobname = 'comms-dispatch-tick';
  IF v_exists = 0 THEN
    SELECT cron.schedule(
      'comms-dispatch-tick',
      '* * * * *',
      $job$
        SELECT net.http_post(
          url := current_setting('app.functions_url', true) || '/comms-dispatcher',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true),
            'Content-Type', 'application/json'
          ),
          body := '{}'::jsonb
        ) WHERE current_setting('app.functions_url', true) IS NOT NULL
            AND current_setting('app.service_role_key', true) IS NOT NULL;
      $job$
    ) INTO v_jobid;
    -- Deactivate until GUCs configured + Edge Function deployed
    PERFORM cron.alter_job(v_jobid, active := false);
    RAISE NOTICE 'comms-dispatch-tick scheduled (jobid=%), INACTIVE. Activate with: SELECT cron.alter_job(%, active := true) once functions_url+service_role_key GUCs are set.', v_jobid, v_jobid;
  END IF;
END $$;

COMMENT ON EXTENSION pg_cron IS 'comms-dispatch-tick scheduled inactive; operator activates after Edge Function deployment.';;
