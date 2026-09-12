namespace = {"__name__": "allim_trial_request_workflow_deploy"}
exec(
    compile(
        open(
            "/tmp/allim-trial-request-workflow/deploy_trial_request_workflow_server.py",
            encoding="utf-8",
        ).read(),
        "/tmp/allim-trial-request-workflow/deploy_trial_request_workflow_server.py",
        "exec",
    ),
    namespace,
    namespace,
)
namespace["main"]()
