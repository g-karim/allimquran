namespace = {}
exec(
    compile(
        open("/tmp/allim-academy-v2/deploy_academy_entry_server.py", encoding="utf-8").read(),
        "/tmp/allim-academy-v2/deploy_academy_entry_server.py",
        "exec",
    ),
    namespace,
    namespace,
)
