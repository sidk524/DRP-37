const { ipcMain } = require("electron");

function registerAuthHandlers() {
    ipcMain.handle("auth:submit", async (event, payload) => {
        const { email, password, formEndpoint } = payload;

        console.log("Form endpoint:", formEndpoint);
        console.log("Email:", email);
        console.log("Password:", password);

        if (!email || !password) {
            return {
                success: false,
                message: "Email and password are required.",
            };
        }

        if (formEndpoint === "login") {
            // Login logic goes here
            return {
                success: true,
                message: "Login submitted successfully.",
            };
        }

        if (formEndpoint === "register") {
            // Register logic goes here
            return {
                success: true,
                message: "Register submitted successfully.",
            };
        }

        return {
            success: false,
            message: "Unknown auth action.",
        };
    });
}

module.exports = {
    registerAuthHandlers,
};