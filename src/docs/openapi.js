const openapi = {
  openapi: "3.0.3",
  info: {
    title: "BakeLink 後端 API",
    version: "1.0.0",
    description:
      "提供身份驗證、使用者管理、商品分類、商品、接單排程與商家端訂單 API。所有受保護端點需使用 JWT，請於 Header 帶入 Authorization: Bearer <token>。",
  },
  tags: [
    { name: "Health", description: "系統健康檢查" },
    { name: "Auth", description: "註冊、登入與取得個人資料" },
    { name: "Users", description: "使用者列表（管理員）" },
    { name: "Product Categories", description: "商品分類 CRUD" },
    { name: "Products", description: "商品 CRUD" },
    { name: "Schedules", description: "接單排程 CRUD 與查詢" },
    { name: "Orders", description: "商家端訂單 CRUD 與狀態管理" },
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
      ScheduleItemBody: {
        type: "object",
        required: ["product_id"],
        properties: {
          product_id: {
            type: "string",
            format: "uuid",
            description: "商品 ID",
            example: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          },
          sales_limit: {
            type: "integer",
            nullable: true,
            description: "銷售上限（null 代表不限量）",
            example: 20,
          },
        },
      },
      ScheduleBody: {
        type: "object",
        required: ["schedule_date", "order_start_at", "order_end_at"],
        properties: {
          schedule_date: {
            type: "string",
            format: "date",
            description: "接單排程日期（每位商家每天僅可一張）",
            example: "2026-02-17",
          },
          status: {
            type: "string",
            enum: ["DRAFT", "ANNOUNCED", "OPEN", "CLOSED", "FULFILLED"],
            description: "接單排程狀態",
            example: "DRAFT",
          },
          order_start_at: {
            type: "string",
            format: "date-time",
            description: "開單開始時間",
            example: "2026-02-17T00:00:00.000Z",
          },
          order_end_at: {
            type: "string",
            format: "date-time",
            description: "收單截止時間",
            example: "2026-02-17T10:00:00.000Z",
          },
          note: {
            type: "string",
            nullable: true,
            description: "接單排程備註",
            example: "今日 14:00 後可取貨",
          },
          items: {
            type: "array",
            description: "接單排程商品（可選）",
            items: { $ref: "#/components/schemas/ScheduleItemBody" },
          },
        },
      },
      OrderItemBody: {
        type: "object",
        required: ["quantity"],
        properties: {
          schedule_item_id: {
            type: "string",
            format: "uuid",
            description: "接單排程品項 ID（schedule_item_id 與 product_id 擇一）",
          },
          product_id: {
            type: "string",
            format: "uuid",
            description: "商品 ID（schedule_item_id 與 product_id 擇一）",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            description: "訂購數量",
            example: 3,
          },
        },
      },
      CreateOrderBody: {
        type: "object",
        required: [
          "schedule_id",
          "customer_name",
          "customer_phone",
          "pickup_time",
          "payment_method",
          "items",
        ],
        properties: {
          schedule_id: {
            type: "string",
            format: "uuid",
            description: "接單排程 ID",
            example: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          },
          customer_name: {
            type: "string",
            description: "訂購者姓名",
            example: "王小明",
          },
          customer_phone: {
            type: "string",
            description: "訂購者電話",
            example: "0912345678",
          },
          pickup_time: {
            type: "string",
            format: "date-time",
            description: "預計取貨時間",
            example: "2026-02-17T12:30:00.000Z",
          },
          note: {
            type: "string",
            nullable: true,
            description: "備註",
            example: "請幫我分裝",
          },
          payment_method: {
            type: "string",
            description: "付款方式",
            example: "cash",
          },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemBody" },
          },
        },
      },
      OrderStatusBody: {
        type: "object",
        required: ["status"],
        properties: {
          status: {
            type: "string",
            enum: ["PLACED", "COMPLETED", "CANCELLED"],
            description: "訂單狀態",
            example: "COMPLETED",
          },
        },
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
    "/schedules": {
      post: {
        tags: ["Schedules"],
        summary: "建立接單排程",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ScheduleBody" } },
          },
        },
        responses: {
          201: { description: "建立成功" },
          400: { description: "請求資料不正確" },
          409: { description: "指定日期已有接單排程" },
        },
      },
    },
    "/schedules/list": {
      post: {
        tags: ["Schedules"],
        summary: "取得指定日期/範圍/月份的接單排程列表",
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
                  date: { type: "string", format: "date", description: "精準日期查詢" },
                  date_from: { type: "string", format: "date" },
                  date_to: { type: "string", format: "date" },
                  month: { type: "string", description: "月份格式 YYYY-MM" },
                  status: {
                    type: "string",
                    enum: ["DRAFT", "ANNOUNCED", "OPEN", "CLOSED", "FULFILLED"],
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "成功" }, 400: { description: "參數格式錯誤" } },
      },
    },
    "/schedules/month/{month}": {
      get: {
        tags: ["Schedules"],
        summary: "取得指定月份接單排程（給月曆）",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "month",
            in: "path",
            required: true,
            description: "月份（YYYY-MM）",
            schema: { type: "string", example: "2026-02" },
          },
        ],
        responses: {
          200: { description: "成功" },
          400: { description: "參數格式錯誤" },
        },
      },
    },
    "/schedules/{date}": {
      get: {
        tags: ["Schedules"],
        summary: "取得指定日期的接單排程與品項",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "date",
            in: "path",
            required: true,
            schema: { type: "string", format: "date", example: "2026-02-17" },
            description: "排程日期 (YYYY-MM-DD 格式)",
          },
        ],
        responses: { 200: { description: "成功" }, 400: { description: "日期格式錯誤" }, 404: { description: "找不到該日期的接單排程" } },
      },
    },
    "/schedules/{id}": {
      put: {
        tags: ["Schedules"],
        summary: "編輯接單排程（可局部更新）",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ScheduleBody" } },
          },
        },
        responses: {
          200: { description: "更新成功" },
          404: { description: "找不到接單排程" },
          409: { description: "日期重複" },
        },
      },
      delete: {
        tags: ["Schedules"],
        summary: "刪除接單排程",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          204: { description: "刪除成功" },
          404: { description: "找不到接單排程" },
          409: { description: "已有訂單，無法刪除" },
        },
      },
    },
    "/orders": {
      post: {
        tags: ["Orders"],
        summary: "建立訂單（商家端）",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateOrderBody" } },
          },
        },
        responses: {
          201: { description: "建立成功" },
          400: { description: "請求資料不正確" },
          404: { description: "接單排程不存在" },
          409: { description: "接單排程狀態或銷售上限衝突" },
        },
      },
    },
    "/orders/list": {
      post: {
        tags: ["Orders"],
        summary: "取得訂單列表",
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
                  schedule_id: { type: "string", format: "uuid" },
                  status: { type: "string", enum: ["PLACED", "COMPLETED", "CANCELLED"] },
                  date_from: { type: "string", format: "date" },
                  date_to: { type: "string", format: "date" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "成功" } },
      },
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "取得單一訂單與明細",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { 200: { description: "成功" }, 404: { description: "找不到訂單" } },
      },
      delete: {
        tags: ["Orders"],
        summary: "刪除訂單",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { 204: { description: "刪除成功" }, 404: { description: "找不到訂單" } },
      },
    },
    "/orders/{id}/status": {
      put: {
        tags: ["Orders"],
        summary: "更改訂單狀態",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/OrderStatusBody" } },
          },
        },
        responses: { 200: { description: "更新成功" }, 404: { description: "找不到訂單" } },
      },
    },
  },
};

module.exports = openapi;



