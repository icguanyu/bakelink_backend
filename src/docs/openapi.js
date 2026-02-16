const openapi = {
  openapi: "3.0.3",
  info: {
    title: "BakeLink 後端 API",
    version: "1.0.0",
    description:
      "提供身份驗證、使用者管理、商品分類與商品相關 API。所有受保護端點需使用 JWT，請於 Header 帶入 Authorization: Bearer <token>。",
  },
  tags: [
    { name: "Health", description: "系統健康檢查" },
    { name: "Auth", description: "註冊、登入與取得個人資料" },
    { name: "Users", description: "使用者列表（管理員）" },
    { name: "Product Categories", description: "商品分類 CRUD" },
    { name: "Products", description: "商品 CRUD" },
  ],
  servers: [{ url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "HTTP Bearer JWT 認證。請於請求標頭加入 Authorization: Bearer <token>。",
      },
    },
    schemas: {
      RegisterBody: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: {
            type: "string",
            description: "使用者名稱",
            example: "Alice",
          },
          email: {
            type: "string",
            description: "電子郵件",
            example: "alice@example.com",
          },
          password: {
            type: "string",
            description: "密碼（至少 8 字元）",
            example: "Password123!",
          },
          phone: {
            type: "string",
            description: "電話（選填）",
            example: "0912345678",
          },
        },
        description: "註冊請求資料",
      },
      LoginBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            description: "電子郵件",
            example: "admin@bakelink.local",
          },
          password: {
            type: "string",
            description: "密碼",
            example: "Admin123!",
          },
        },
        description: "登入請求資料",
      },
      CategoryBody: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            description: "分類名稱",
            example: "貝果",
          },
        },
        description: "分類資料",
      },
      ProductBody: {
        type: "object",
        required: ["name", "category_id", "price"],
        properties: {
          name: {
            type: "string",
            description: "商品名稱",
            example: "巧克力貝果",
          },
          category_id: {
            type: "string",
            format: "uuid",
            description: "分類 ID（UUID）",
            example: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          },
          price: {
            type: "number",
            format: "float",
            description: "售價，需為非負數字（單位：元）",
            example: 99.0,
          },
          description: {
            type: "string",
            description: "商品描述（選填）",
            example: "手工製作的巧克力貝果，外酥內軟",
          },
          ingredients: {
            type: "string",
            description: "成分簡述（選填）",
            example: "麵粉、可可粉、糖、鹽、酵母",
          },
          is_active: {
            type: "boolean",
            description: "是否上架（選填，預設 true）",
            example: true,
          },
          image_urls: {
            type: "array",
            items: { type: "string" },
            description: "商品圖片 URL 陣列（選填）",
            example: ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
          },
          ingredient_details: {
            type: "array",
            description: "成分明細（選填）",
            items: {
              type: "object",
              required: ["name", "grams", "is_visible"],
              properties: {
                name: { type: "string", example: "麵粉" },
                grams: { type: "number", example: 250.5 },
                is_visible: { type: "boolean", example: true },
              },
            },
            example: [
              { name: "麵粉", grams: 250, is_visible: true },
              { name: "可可粉", grams: 30, is_visible: true },
            ],
          },
        },
        description: "商品資料",
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer", description: "目前頁碼", example: 1 },
          limit: { type: "integer", description: "每頁筆數", example: 10 },
          total: { type: "integer", description: "總筆數", example: 23 },
          total_pages: { type: "integer", description: "總頁數", example: 3 },
        },
        description: "分頁資訊",
      },
    },
  },
  paths: {
    "/": {
      get: {
        tags: ["Health"],
        summary: "健康檢查",
        responses: {
          200: {
            description: "伺服器執行中",
            content: { "text/plain": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "註冊使用者",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } },
          },
        },
        responses: {
          201: { description: "建立成功" },
          400: { description: "請求資料不正確" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "登入並取得存取權杖",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LoginBody" } },
          },
        },
        responses: {
          200: { description: "成功取得權杖" },
          401: { description: "帳號或密碼錯誤" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "取得目前登入使用者資料",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "成功" },
          401: { description: "未授權" },
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "列出所有使用者（僅管理員）",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "成功" },
          401: { description: "未授權" },
          403: { description: "禁止存取" },
        },
      },
    },
    "/product-categories": {
      post: {
        tags: ["Product Categories"],
        summary: "建立分類",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CategoryBody" } },
          },
        },
        responses: {
          201: { description: "建立成功" },
          409: { description: "名稱重複" },
        },
      },
    },
    "/product-categories/list": {
      post: {
        tags: ["Product Categories"],
        summary: "列出分類（POST 帶 body 參數）",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  page: { type: "integer", minimum: 1, default: 1 },
                  limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
                  keyword: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "成功" }, 401: { description: "未授權" } },
      },
    },
    "/product-categories/{id}": {
      get: {
        tags: ["Product Categories"],
        summary: "依 ID 取得分類",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "分類 UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { 200: { description: "成功" }, 404: { description: "找不到" } },
      },
      put: {
        tags: ["Product Categories"],
        summary: "更新分類",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "分類 UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CategoryBody" } },
          },
        },
        responses: { 200: { description: "成功" }, 404: { description: "找不到" } },
      },
      delete: {
        tags: ["Product Categories"],
        summary: "刪除分類",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "分類 UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "刪除成功（無內容）" },
          404: { description: "找不到" },
        },
      },
    },
    "/products": {
      post: {
        tags: ["Products"],
        summary: "建立商品",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProductBody" } },
          },
        },
        responses: {
          201: { description: "建立成功" },
          400: { description: "分類不存在或不合法" },
        },
      },
    },
    "/products/list": {
      post: {
        tags: ["Products"],
        summary: "列出商品（POST 帶 body 參數）",
        description: "分頁參數為選填，不帶 page/limit 會回傳全部資料。",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  page: {
                    type: "integer",
                    minimum: 1,
                    default: 1,
                    description: "頁碼（選填；未帶 page/limit 時回傳全部）",
                  },
                  limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 100,
                    default: 10,
                    description: "每頁數量（選填；未帶 page/limit 時回傳全部）",
                  },
                  keyword: { type: "string", description: "關鍵字（選填）" },
                  category_id: {
                    type: "string",
                    format: "uuid",
                    description: "分類 ID 過濾（選填）",
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "成功" }, 401: { description: "未授權" } },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "依 ID 取得商品",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "商品 UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { 200: { description: "成功" }, 404: { description: "找不到" } },
      },
      put: {
        tags: ["Products"],
        summary: "更新商品",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "商品 UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProductBody" } },
          },
        },
        responses: { 200: { description: "成功" }, 404: { description: "找不到" } },
      },
      delete: {
        tags: ["Products"],
        summary: "刪除商品",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "商品 UUID",
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "刪除成功（無內容）" },
          404: { description: "找不到" },
        },
      },
    },
  },
};

module.exports = openapi;
