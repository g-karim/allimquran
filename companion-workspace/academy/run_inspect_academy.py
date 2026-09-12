namespace = {}
exec(
    compile(
        open("/tmp/allim_inspect_academy_server.py", encoding="utf-8").read(),
        "/tmp/allim_inspect_academy_server.py",
        "exec",
    ),
    namespace,
    namespace,
)
namespace["main"]()
