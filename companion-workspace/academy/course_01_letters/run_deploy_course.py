namespace = {"__name__": "allim_course_01_deploy"}
exec(
    compile(
        open("/tmp/allim-course-01/deploy_course_server.py", encoding="utf-8").read(),
        "/tmp/allim-course-01/deploy_course_server.py",
        "exec",
    ),
    namespace,
    namespace,
)
namespace["main"]("/tmp/allim-course-01", publish=False)

