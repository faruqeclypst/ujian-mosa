routerAdd("GET", "/api/init-banks", (c) => {
    try {
        const existing = $app.dao().findCollectionByNameOrId("bank_accounts");
        return c.json(200, { message: "Collection already exists." });
    } catch (e) {
        // Doesn't exist, create it
        const collection = new Collection({
            name: "bank_accounts",
            type: "base",
            listRule: "",
            viewRule: "",
            createRule: null,
            updateRule: null,
            deleteRule: null,
            schema: [
                { name: "bank_name", type: "text", required: true },
                { name: "bank_code", type: "text", required: true },
                { name: "account_number", type: "text", required: true },
                { name: "account_name", type: "text", required: true },
                { name: "is_active", type: "bool" }
            ]
        });
        $app.dao().saveCollection(collection);
        return c.json(200, { message: "Collection bank_accounts created successfully." });
    }
});
