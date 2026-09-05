app_name = "allimquran"
app_title = "ALLIM Quran"
app_publisher = "ALLIM Quran contributors"
app_description = "A community-built Quran learning application for Frappe"
app_email = "65041776+g-karim@users.noreply.github.com"
app_license = "mit"
required_apps = ["lms"]

after_install = "allimquran.setup.after_install"
before_migrate = "allimquran.setup.preflight"
after_migrate = [
    "allimquran.setup.sync",
    "allimquran.search_intelligence.after_migrate",
]

# ALLIM SEARCH INTELLIGENCE START
scheduler_events = {
    "daily_long": ["allimquran.search_intelligence.run_scheduled_audit"],
}
update_website_context = ["allimquran.search_intelligence.extend_website_context"]
# ALLIM SEARCH INTELLIGENCE END

# Keep installation independent of the existing site's optional integrations.
# Website routes, content migrations and LMS integration will be added in later releases.
