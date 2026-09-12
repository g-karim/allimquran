namespace = {"__name__": "allim_course_01_verify"}
exec(
    compile(
        open("/tmp/allim-course-01/verify_course_server.py", encoding="utf-8").read(),
        "/tmp/allim-course-01/verify_course_server.py",
        "exec",
    ),
    namespace,
    namespace,
)
namespace["main"]()

