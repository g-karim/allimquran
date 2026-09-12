namespace = {"__name__": "allim_trial_request_workflow_verify"}
exec(
    compile(
        open(
            "/tmp/allim-trial-request-workflow/verify_trial_request_workflow_server.py",
            encoding="utf-8",
        ).read(),
        "/tmp/allim-trial-request-workflow/verify_trial_request_workflow_server.py",
        "exec",
    ),
    namespace,
    namespace,
)
namespace["main"]()
