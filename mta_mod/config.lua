Config = {}

Config.Database = {
    host = "localhost",
    user = "root",
    pass = "",
    name = "mta",
    port = 3306
}

Config.Discord = {
    apiKey = "", -- API_SECRET_KEY in the Bot .env
    secret = "", -- SIGNATURE_KEY in the Bot .env
    botUrl = "http://localhost:3001/internal/" -- Address of your Discord Bot's internal API
}
