namespace = {"__name__": "allim_academy_deploy"}
exec(
    compile(
        open("/tmp/allim-academy-release/academy/deploy_academy_server.py", encoding="utf-8").read(),
        "/tmp/allim-academy-release/academy/deploy_academy_server.py",
        "exec",
    ),
    namespace,
    namespace,
)
namespace["main"]("/tmp/allim-academy-release")
