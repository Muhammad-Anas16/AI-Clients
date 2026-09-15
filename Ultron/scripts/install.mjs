import { installBaseline } from "../src/services/install.service.js";
installBaseline().catch(error => { console.error(`\n[INSTALL] FAILED: ${error.message}`); console.error("[INSTALL] No manual setup command is required. Fix the reported dependency/network error and run npm i again."); process.exit(1); });
