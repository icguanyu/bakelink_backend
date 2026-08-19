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
    { name: "Upload", description: "圖片上傳" },
    { name: "Shop (Public)", description: "前台公開 API，無需登入。供消費者瀏覽店家、行程與下單使用。" },
    { name: "LINE Notifications", description: "LINE Bot 綁定與訂單推播通知" },
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
      UserSettingsBody: {
        type: "object",
        properties: {
          shopSlug: {
            type: "string",
            description: "店家專屬網址代碼（3-50 字，小寫英數字與連字號）",
            example: "nice-bread",
          },
          avatar: { type: "string", description: "商家頭像 URL", example: "" },
          cover: { type: "string", description: "商家封面照 URL", example: "" },
          shopName: { type: "string", description: "店名", example: "山丘烘焙坊" },
          owner: { type: "string", description: "負責人名稱", example: "王麵麥" },
          phone: { type: "string", description: "電話", example: "02-1234-5678" },
          email: { type: "string", description: "電子郵件", example: "hello@bakery.test" },
          address: { type: "string", description: "地址", example: "台北市中山區麵包路 123 號" },
          intro: {
            type: "string",
            description: "店家簡介",
            example: "每日現烤小麥香，主打酸種、歐包與早午餐。",
          },
          orderPickupTime: { type: "string", description: "預設取貨時間（HH:mm）", example: "14:00" },
          paymentMethods: {
            type: "array",
            items: { type: "string" },
            description: "付款方式",
            example: ["cash"],
          },
          pickupMethods: {
            type: "array",
            items: { type: "string" },
            description: "取貨方式",
            example: ["pickup", "delivery"],
          },
          shipping: {
            type: "object",
            properties: {
              freeThreshold: { type: "number", description: "免運門檻", example: 800 },
              fee: { type: "number", description: "運費", example: 100 },
              note: { type: "string", description: "運費備註", example: "滿 $800 免運費" },
            },
          },
          packaging: {
            type: "object",
            properties: {
              defaultPack: { type: "string", description: "包裝方式", example: "紙袋" },
              packFee: { type: "number", description: "包裝費", example: 5 },
              ecoDiscount: { type: "number", description: "環保折扣", example: 10 },
              note: { type: "string", description: "包裝備註", example: "歡迎自備容器" },
            },
          },
          businessHours: {
            type: "array",
            description: "營業時間",
            items: {
              type: "object",
              required: ["day", "enabled", "time"],
              properties: {
                day: { type: "integer", description: "0=日, 1=一, ..., 6=六", example: 1 },
                enabled: { type: "boolean", example: true },
                time: {
                  type: "array",
                  items: { type: "string", example: "09:00" },
                  minItems: 2,
                  maxItems: 2,
                },
              },
            },
            example: [
              { day: 1, enabled: true, time: ["09:00", "18:00"] },
              { day: 2, enabled: true, time: ["09:00", "18:00"] },
              { day: 3, enabled: true, time: ["09:00", "18:00"] },
              { day: 4, enabled: true, time: ["09:00", "18:00"] },
              { day: 5, enabled: true, time: ["09:00", "18:00"] },
              { day: 6, enabled: false, time: ["10:00", "16:00"] },
              { day: 0, enabled: false, time: ["10:00", "16:00"] },
            ],
          },
        },
        description: "店家設定資料",
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
          is_sliceable: {
            type: "boolean",
            description: "是否可切片（選填，預設 false）",
            example: true,
          },
          slice_price: {
            type: "number",
            format: "float",
            nullable: true,
            description: "切片售價（選填，is_sliceable 為 true 時使用，需為非負數）",
            example: 49.0,
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
        required: ["schedule_date"],
        properties: {
          schedule_date: {
            type: "string",
            format: "date",
            description: "排程日期（同一天可建立多場巡迴）",
            example: "2026-06-14",
          },
          status: {
            type: "string",
            enum: ["DRAFT", "ANNOUNCED", "OPEN", "CLOSED", "FULFILLED"],
            description: "排程狀態",
            example: "DRAFT",
          },
          order_start_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "開單開始時間（選填）",
            example: "2026-06-14T00:00:00.000Z",
          },
          order_end_at: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "收單截止時間（選填）",
            example: "2026-06-14T10:00:00.000Z",
          },
          note: {
            type: "string",
            nullable: true,
            description: "排程備註",
            example: "今日 14:00 後可取貨",
          },
          venue_name: {
            type: "string",
            nullable: true,
            description: "巡迴場地名稱（選填，null = 一般店面行程）",
            example: "嘉義場",
          },
          venue_address: {
            type: "string",
            nullable: true,
            description: "巡迴場地地址（選填）",
            example: "嘉義市東區某路123號",
          },
          venue_start: {
            type: "string",
            nullable: true,
            description: "現場販售開始時間，格式 HH:MM（選填）",
            example: "10:00",
          },
          venue_end: {
            type: "string",
            nullable: true,
            description: "現場販售結束時間，格式 HH:MM（選填，須晚於 venue_start）",
            example: "14:00",
          },
          items: {
            type: "array",
            description: "排程商品（選填）",
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
          is_sliced: {
            type: "boolean",
            description: "此項目是否切片",
            example: false,
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
          customer_address: {
            type: "string",
            nullable: true,
            description: "訂購者地址（宅配可填）",
            example: "台北市中山區麵包路 123 號",
          },
          pickup_time: {
            type: "string",
            description: "預計取貨時間（HH:mm）",
            example: "12:30",
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
          bring_own_bag: {
            type: "boolean",
            description: "是否自備購物袋",
            example: false,
          },
          pickup_method: {
            type: "string",
            enum: ["PICKUP", "DELIVERY"],
            description: "取貨方式（PICKUP=自取, DELIVERY=宅配）",
            example: "PICKUP",
          },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemBody" },
          },
        },
      },
      UpdateOrderBody: {
        type: "object",
        required: [
          "customer_name",
          "customer_phone",
          "pickup_time",
          "payment_method",
          "items",
        ],
        properties: {
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
          customer_address: {
            type: "string",
            nullable: true,
            description: "訂購者地址（宅配可填）",
            example: "台北市中山區麵包路 123 號",
          },
          pickup_time: {
            type: "string",
            description: "預計取貨時間（HH:mm）",
            example: "12:30",
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
          bring_own_bag: {
            type: "boolean",
            description: "是否自備購物袋",
            example: false,
          },
          pickup_method: {
            type: "string",
            enum: ["PICKUP", "DELIVERY"],
            description: "取貨方式（PICKUP=自取, DELIVERY=宅配）",
            example: "PICKUP",
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
      UploadFileResponse: {
        type: "object",
        properties: {
          url: { type: "string", example: "https://xxx.supabase.co/storage/v1/object/public/uploads/..." },
        },
      },
      CustomerOrderBody: {
        type: "object",
        required: ["schedule_id", "customer_name", "customer_phone", "pickup_time", "payment_method", "items"],
        properties: {
          schedule_id: { type: "string", format: "uuid", description: "行程 ID", example: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
          customer_name: { type: "string", description: "訂購者姓名", example: "王小明" },
          customer_phone: { type: "string", description: "訂購者電話", example: "0912345678" },
          customer_address: { type: "string", nullable: true, description: "地址（宅配填寫）", example: "台北市中山區麵包路 123 號" },
          pickup_time: { type: "string", description: "取貨時間（HH:mm）", example: "14:00" },
          payment_method: { type: "string", description: "付款方式", example: "cash" },
          note: { type: "string", nullable: true, description: "備註", example: "請幫我分裝" },
          bring_own_bag: { type: "boolean", description: "是否自備袋子", example: false },
          pickup_method: { type: "string", enum: ["PICKUP", "DELIVERY"], description: "取貨方式", example: "PICKUP" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["schedule_item_id", "quantity"],
              properties: {
                schedule_item_id: { type: "string", format: "uuid", description: "行程品項 ID" },
                quantity: { type: "integer", minimum: 1, example: 2 },
                is_sliced: { type: "boolean", description: "是否切片", example: false },
              },
            },
          },
        },
        description: "消費者下單資料",
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
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "取得目前店家設定",
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: "成功",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/UserSettingsBody" } },
            },
          },
          401: { description: "未授權" },
          404: { description: "找不到使用者" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "更新店家設定（完整或局部）",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UserSettingsBody" } },
          },
        },
        responses: {
          200: { description: "更新成功" },
          400: { description: "請求資料不正確" },
          401: { description: "未授權" },
          409: { description: "Email 已存在" },
        },
      },
      patch: {
        tags: ["Users"],
        summary: "更新店家設定（局部）",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UserSettingsBody" } },
          },
        },
        responses: {
          200: { description: "更新成功" },
          400: { description: "請求資料不正確" },
          401: { description: "未授權" },
          409: { description: "Email 已存在" },
        },
      },
    },
    "/users/me/line": {
      put: {
        tags: ["LINE Notifications"],
        summary: "綁定 LINE User ID",
        description: "店家將 LINE Bot 回傳的 User ID 填入以啟用訂單通知。User ID 格式為 U 開頭、共 33 字元的十六進位字串。",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["lineUserId"],
                properties: {
                  lineUserId: {
                    type: "string",
                    example: "Ue1234567890abcdef1234567890abcd",
                    description: "LINE User ID（U 開頭，共 33 字元）",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "綁定成功" },
          400: { description: "lineUserId 格式不正確" },
          401: { description: "未授權" },
        },
      },
      delete: {
        tags: ["LINE Notifications"],
        summary: "解除 LINE 綁定",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "解除成功" },
          401: { description: "未授權" },
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
        summary: "取得指定日期的接單排程與品項（回傳該日第一筆）",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "date",
            in: "path",
            required: true,
            schema: { type: "string", format: "date", example: "2026-06-14" },
            description: "排程日期 (YYYY-MM-DD 格式)",
          },
        ],
        responses: { 200: { description: "成功" }, 400: { description: "日期格式錯誤" } },
      },
    },
    "/schedules/detail/{id}": {
      get: {
        tags: ["Schedules"],
        summary: "取得指定排程詳情（含品項與訂單，支援一天多場）",
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
            description: "排程 ID",
          },
        ],
        responses: { 200: { description: "成功，找不到回傳 null" }, 500: { description: "伺服器錯誤" } },
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
      put: {
        tags: ["Orders"],
        summary: "編輯訂單",
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
            "application/json": { schema: { $ref: "#/components/schemas/UpdateOrderBody" } },
          },
        },
        responses: {
          200: { description: "更新成功" },
          400: { description: "請求資料不正確" },
          404: { description: "找不到訂單" },
          409: { description: "訂單狀態、接單排程狀態或銷售上限衝突" },
        },
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
    "/shop/{slug}": {
      get: {
        tags: ["Shop (Public)"],
        summary: "取得店家公開資訊",
        description: "無需登入。回傳店名、頭像、簡介、付款方式、取貨方式、營業時間等。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
        ],
        responses: {
          200: { description: "成功" },
          404: { description: "找不到店家" },
        },
      },
    },
    "/shop/{slug}/schedules": {
      get: {
        tags: ["Shop (Public)"],
        summary: "取得店家行程列表",
        description: "無需登入。回傳 ANNOUNCED、OPEN、CLOSED 三種狀態的行程。可用 month 參數篩選月份。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
          { name: "month", in: "query", required: false, schema: { type: "string", example: "2026-05" }, description: "月份（YYYY-MM），不帶則回傳全部行程" },
        ],
        responses: {
          200: { description: "成功" },
          400: { description: "month 格式錯誤" },
          404: { description: "找不到店家" },
        },
      },
    },
    "/shop/{slug}/schedules/{date}": {
      get: {
        tags: ["Shop (Public)"],
        summary: "取得特定日期行程詳細與品項剩餘數量",
        description: "無需登入。回傳該日期 ANNOUNCED、OPEN 或 CLOSED 狀態的行程與各品項（含 remaining 剩餘數量，null 代表不限量）。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
          { name: "date", in: "path", required: true, schema: { type: "string", format: "date", example: "2026-05-28" }, description: "行程日期（YYYY-MM-DD）" },
        ],
        responses: {
          200: { description: "成功" },
          400: { description: "日期格式錯誤" },
          404: { description: "找不到店家或行程" },
        },
      },
    },
    "/shop/{slug}/categories": {
      get: {
        tags: ["Shop (Public)"],
        summary: "取得店家有上架商品的種類清單",
        description: "無需登入。只回傳至少有一個上架商品（is_active = true）的種類，依名稱排序。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
        ],
        responses: {
          200: {
            description: "成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          name: { type: "string", example: "貝果" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: "找不到店家" },
        },
      },
    },
    "/shop/{slug}/products": {
      get: {
        tags: ["Shop (Public)"],
        summary: "取得店家上架商品清單",
        description: "無需登入。只回傳 is_active = true 的商品，依名稱排序。可用 category_id 篩選種類。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
          { name: "category_id", in: "query", required: false, schema: { type: "string", format: "uuid" }, description: "種類 ID（選填，不帶則回傳全部）" },
        ],
        responses: {
          200: {
            description: "成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", format: "uuid" },
                          category_id: { type: "string", format: "uuid" },
                          name: { type: "string", example: "巧克力貝果" },
                          price: { type: "number", example: 99 },
                          description: { type: "string", nullable: true },
                          ingredients: { type: "string", nullable: true },
                          image_urls: { type: "array", items: { type: "string" } },
                          ingredient_details: { type: "array", items: { type: "object" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          404: { description: "找不到店家" },
        },
      },
    },
    "/shop/{slug}/orders": {
      get: {
        tags: ["Shop (Public)"],
        summary: "消費者用電話查詢所有訂單",
        description: "無需登入。帶 phone 查詢參數，回傳該電話的所有訂單（含已完成），最新在前。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
          { name: "phone", in: "query", required: true, schema: { type: "string", example: "0912345678" }, description: "訂購時填寫的電話" },
        ],
        responses: {
          200: { description: "成功，data 陣列（無訂單時回傳空陣列）" },
          400: { description: "缺少 phone 參數" },
          404: { description: "找不到店家" },
        },
      },
      post: {
        tags: ["Shop (Public)"],
        summary: "消費者下單",
        description: "無需登入。行程狀態必須為 OPEN，含防超賣機制。下單成功後會自動推播 LINE 通知給已綁定的店家。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CustomerOrderBody" } },
          },
        },
        responses: {
          201: { description: "下單成功" },
          400: { description: "請求資料不正確或品項不存在" },
          404: { description: "找不到店家或行程" },
          409: { description: "行程未開放接單或品項數量不足" },
        },
      },
    },
    "/shop/{slug}/orders/{orderNo}": {
      get: {
        tags: ["Shop (Public)"],
        summary: "消費者查詢訂單",
        description: "無需登入。需帶 phone query 參數驗證身份。",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string", example: "nice-bread" }, description: "店家 slug" },
          { name: "orderNo", in: "path", required: true, schema: { type: "string", example: "912-20260528-001" }, description: "訂單編號" },
          { name: "phone", in: "query", required: true, schema: { type: "string", example: "0912345678" }, description: "訂購時填寫的電話（用於驗證）" },
        ],
        responses: {
          200: { description: "成功" },
          400: { description: "缺少 phone 參數" },
          404: { description: "找不到訂單" },
        },
      },
    },
    "/UploadFile": {
      post: {
        tags: ["Upload"],
        summary: "上傳單張圖片",
        description: "使用 multipart/form-data，上傳欄位名稱為 file。",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "圖片檔案",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "上傳成功",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadFileResponse" },
              },
            },
          },
          400: { description: "請求格式錯誤或檔案不合法" },
          401: { description: "未授權" },
          500: { description: "伺服器錯誤" },
          502: { description: "儲存服務錯誤" },
        },
      },
    },
    "/UploadAvatar": {
      post: {
        tags: ["Upload"],
        summary: "上傳使用者頭像",
        description: "使用 multipart/form-data，上傳欄位名稱為 file。",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "頭像圖片檔案",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "上傳成功",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadFileResponse" },
              },
            },
          },
          400: { description: "請求格式錯誤或檔案不合法" },
          401: { description: "未授權" },
          500: { description: "伺服器錯誤" },
          502: { description: "儲存服務錯誤" },
        },
      },
    },
    "/UploadCover": {
      post: {
        tags: ["Upload"],
        summary: "上傳使用者封面照",
        description: "使用 multipart/form-data，上傳欄位名稱為 file。上傳後自動更新 users.cover。",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "封面圖片檔案",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "上傳成功",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UploadFileResponse" },
              },
            },
          },
          400: { description: "請求格式錯誤或檔案不合法" },
          401: { description: "未授權" },
          500: { description: "伺服器錯誤" },
          502: { description: "儲存服務錯誤" },
        },
      },
    },
    "/webhooks/line": {
      post: {
        tags: ["LINE Notifications"],
        summary: "LINE Bot Webhook",
        description: "接收 LINE Platform 的事件推播（Follow、訊息等）。店家加入 Bot 好友後，Bot 會自動回覆其 LINE User ID，供店家複製至設定頁完成綁定。此端點不需 JWT，由 LINE Platform 呼叫，使用 HMAC-SHA256 簽名驗證。",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  events: {
                    type: "array",
                    items: { type: "object" },
                    description: "LINE 平台事件陣列",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "成功接收" },
          400: { description: "簽名驗證失敗" },
        },
      },
    },
  },
};

module.exports = openapi;
