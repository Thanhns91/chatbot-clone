const ok = (description = "Success") => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
      },
    },
  },
});

const error = (description = "Error") => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          message: {
            type: "string",
            example: "Something went wrong",
          },
          detail: {
            type: "string",
            example: "Error detail",
          },
        },
      },
    },
  },
});

const idParam = (name, description = "ID") => ({
  name,
  in: "path",
  required: true,
  description,
  schema: {
    type: "string",
  },
});

const swaggerSpec = {
  openapi: "3.0.0",

  info: {
    title: "AI Learning Chatbot API",
    version: "1.0.0",
    description: "Swagger documentation for AI Learning Chatbot backend APIs.",
  },

  servers: [
    {
      url: process.env.SERVER_URL || "/",
      description: "Current server",
    },
  ],

  tags: [
    {
      name: "Root",
      description: "Server health check",
    },
    {
      name: "Auth",
      description: "Register, login, Google login and teacher account APIs",
    },
    {
      name: "Users",
      description: "User management, profile, avatar and admin statistics APIs",
    },
    {
      name: "Upload",
      description: "Document upload, duplicate checking and versioning APIs",
    },
    {
      name: "Documents",
      description: "Document library, view, download and stats APIs",
    },
    {
      name: "Chat",
      description: "RAG chatbot API",
    },
    {
      name: "Chat History",
      description: "Chat sessions and chat messages APIs",
    },
    {
      name: "Feedback",
      description: "Student learning feedback and teacher summary APIs",
    },
    {
      name: "Notifications",
      description: "User notification APIs",
    },
  ],

  components: {
    schemas: {
      User: {
        type: "object",
        properties: {
          userId: {
            type: "integer",
            example: 1,
          },
          fullName: {
            type: "string",
            example: "Nguyen Van A",
          },
          name: {
            type: "string",
            example: "Nguyen Van A",
          },
          email: {
            type: "string",
            example: "student@gmail.com",
          },
          role: {
            type: "string",
            enum: ["admin", "teacher", "student"],
            example: "student",
          },
          status: {
            type: "string",
            enum: ["active", "blocked", "pending"],
            example: "active",
          },
          avatar_url: {
            type: "string",
            example: "https://res.cloudinary.com/demo/avatar.jpg",
          },
          avatarUrl: {
            type: "string",
            example: "https://res.cloudinary.com/demo/avatar.jpg",
          },
        },
      },

      Document: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            example: 1,
          },
          documentId: {
            type: "string",
            example: "5b7c1c6e-4a2d-4b2c-a7a1-123456789abc",
          },
          fileName: {
            type: "string",
            example: "lesson.pdf",
          },
          fileType: {
            type: "string",
            example: "application/pdf",
          },
          fileUrl: {
            type: "string",
            example: "https://res.cloudinary.com/demo/raw/upload/file.pdf",
          },
          contentHash: {
            type: "string",
            example: "sha256_hash_here",
          },
          uploaderId: {
            type: "integer",
            example: 1,
          },
          uploadedBy: {
            type: "string",
            enum: ["teacher", "student", "admin"],
            example: "student",
          },
          uploadStatus: {
            type: "string",
            enum: ["success", "failed"],
            example: "success",
          },
          reviewStatus: {
            type: "string",
            enum: ["pending", "approved", "rejected", "private"],
            example: "private",
          },
          versionNo: {
            type: "integer",
            example: 1,
          },
          versionGroupId: {
            type: "string",
            example: "5b7c1c6e-4a2d-4b2c-a7a1-123456789abc",
          },
          vectorDocumentId: {
            type: "string",
            example: "5b7c1c6e-4a2d-4b2c-a7a1-123456789abc",
          },
          isDuplicate: {
            type: "boolean",
            example: false,
          },
          originalDocumentId: {
            type: "string",
            nullable: true,
            example: null,
          },
          uploadDate: {
            type: "string",
            format: "date-time",
          },
          uploaderName: {
            type: "string",
            example: "Nguyen Van A",
          },
        },
      },

      ChatSession: {
        type: "object",
        properties: {
          id: {
            type: "string",
            example: "1",
          },
          sessionId: {
            type: "integer",
            example: 1,
          },
          userId: {
            type: "integer",
            example: 1,
          },
          documentId: {
            type: "string",
            example: "doc-uuid",
          },
          title: {
            type: "string",
            example: "New Chat",
          },
          preview: {
            type: "string",
            example: "Last message preview",
          },
          messageCount: {
            type: "integer",
            example: 4,
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },

      ChatMessage: {
        type: "object",
        properties: {
          messageId: {
            type: "integer",
            example: 1,
          },
          sessionId: {
            type: "integer",
            example: 1,
          },
          sender: {
            type: "string",
            enum: ["user", "ai", "system"],
            example: "user",
          },
          message: {
            type: "string",
            example: "Nội dung tài liệu này nói gì?",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },

      StudentFeedback: {
        type: "object",
        properties: {
          feedbackId: {
            type: "integer",
            example: 1,
          },
          studentId: {
            type: "integer",
            example: 3,
          },
          teacherId: {
            type: "integer",
            example: 2,
          },
          documentId: {
            type: "string",
            example: "document-uuid",
          },
          sessionId: {
            type: "integer",
            example: 1,
          },
          summary: {
            type: "string",
            example: "Học sinh hiểu được nội dung cơ bản của tài liệu.",
          },
          strengths: {
            type: "string",
            example: "Biết đặt câu hỏi đúng trọng tâm.",
          },
          weaknesses: {
            type: "string",
            example: "Còn chưa rõ một số khái niệm nâng cao.",
          },
          recommendations: {
            type: "string",
            example: "Giáo viên nên giải thích thêm phần ví dụ thực tế.",
          },
          score: {
            type: "integer",
            example: 80,
          },
          status: {
            type: "string",
            enum: ["generated", "reviewed"],
            example: "generated",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },

      Notification: {
        type: "object",
        properties: {
          notificationId: {
            type: "integer",
            example: 1,
          },
          receiverId: {
            type: "integer",
            example: 3,
          },
          documentId: {
            type: "integer",
            example: 1,
          },
          title: {
            type: "string",
            example: "New teacher material uploaded",
          },
          message: {
            type: "string",
            example: "Teacher uploaded a new file: lesson.pdf",
          },
          type: {
            type: "string",
            example: "student_upload",
          },
          isRead: {
            type: "boolean",
            example: false,
          },
          fileName: {
            type: "string",
            example: "lesson.pdf",
          },
          fileUrl: {
            type: "string",
            example: "https://res.cloudinary.com/demo/raw/upload/file.pdf",
          },
          uploaderName: {
            type: "string",
            example: "Teacher A",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
    },
  },

  paths: {
    "/": {
      get: {
        tags: ["Root"],
        summary: "Check backend status",
        responses: {
          200: {
            description: "Backend running",
            content: {
              "text/plain": {
                schema: {
                  type: "string",
                  example: "Backend Hugging Face RAG running",
                },
              },
            },
          },
        },
      },
    },

    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register student account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email", "password"],
                properties: {
                  fullName: {
                    type: "string",
                    example: "Nguyen Van A",
                  },
                  email: {
                    type: "string",
                    example: "student@gmail.com",
                  },
                  password: {
                    type: "string",
                    example: "123456",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Register successful"),
          400: error("Missing required fields or email already exists"),
          500: error("Register failed"),
        },
      },
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    example: "student@gmail.com",
                  },
                  password: {
                    type: "string",
                    example: "123456",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Login successful"),
          400: error("Email or password is incorrect"),
          403: error("Account is blocked"),
          500: error("Login failed"),
        },
      },
    },

    "/auth/google-login": {
      post: {
        tags: ["Auth"],
        summary: "Login with Google account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "fullName"],
                properties: {
                  email: {
                    type: "string",
                    example: "student@gmail.com",
                  },
                  fullName: {
                    type: "string",
                    example: "Nguyen Van A",
                  },
                  uid: {
                    type: "string",
                    example: "google_uid_here",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Google login successful"),
          400: error("Missing information"),
          403: error("Account is blocked"),
          500: error("Server error"),
        },
      },
    },

    "/auth/admin/create-teacher": {
      post: {
        tags: ["Auth"],
        summary: "Admin creates teacher account and sends email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email"],
                properties: {
                  fullName: {
                    type: "string",
                    example: "Teacher A",
                  },
                  email: {
                    type: "string",
                    example: "teacher@gmail.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Teacher account created"),
          400: error("Missing fullName/email or email already exists"),
          500: error("Create teacher failed"),
        },
      },
    },

    "/upload": {
      post: {
        tags: ["Upload"],
        summary: "Upload document",
        description:
          "Upload PDF, DOC, DOCX. Backend extracts text, checks contentHash, creates version if allowVersion=true, otherwise asks frontend to confirm.",
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
                  },
                  uploadedBy: {
                    type: "string",
                    enum: ["student", "teacher", "admin"],
                    example: "student",
                  },
                  uploaderId: {
                    type: "integer",
                    example: 1,
                  },
                  allowVersion: {
                    type: "string",
                    enum: ["true", "false"],
                    example: "false",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Upload success or duplicate confirmation required"),
          400: error("No file uploaded"),
          409: error("Duplicate document found"),
          500: error("Upload failed"),
        },
      },
    },

    "/chat": {
      post: {
        tags: ["Chat"],
        summary: "Ask AI based on selected document",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["documentId", "message"],
                properties: {
                  documentId: {
                    type: "string",
                    example: "document-uuid",
                  },
                  message: {
                    type: "string",
                    example: "Tài liệu này nói về nội dung gì?",
                  },
                  responseLanguage: {
                    type: "string",
                    enum: ["vi", "en"],
                    example: "vi",
                  },
                  approvedAnswers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: {
                          type: "string",
                          example: "Câu hỏi cũ",
                        },
                        answer: {
                          type: "string",
                          example: "Câu trả lời đã được duyệt",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("AI answer"),
          400: error("Missing documentId or message"),
          500: error("Chat error"),
        },
      },
    },

    "/documents": {
      get: {
        tags: ["Documents"],
        summary: "Get all documents",
        responses: {
          200: ok("Documents loaded"),
          500: error("Cannot load documents"),
        },
      },
    },

    "/documents/{documentId}": {
      delete: {
        tags: ["Documents"],
        summary: "Delete document by documentId",
        parameters: [idParam("documentId", "Document UUID")],
        responses: {
          200: ok("Document deleted"),
          500: error("Delete failed"),
        },
      },
    },

    "/documents/student-files": {
      get: {
        tags: ["Documents"],
        summary: "Get all student uploaded files",
        responses: {
          200: ok("Student files loaded"),
          500: error("Cannot load student files"),
        },
      },
    },

    "/documents/library": {
      get: {
        tags: ["Documents"],
        summary: "Get library documents by userId and role",
        parameters: [
          {
            name: "userId",
            in: "query",
            required: true,
            schema: {
              type: "integer",
              example: 1,
            },
          },
          {
            name: "role",
            in: "query",
            required: true,
            schema: {
              type: "string",
              enum: ["admin", "teacher", "student"],
              example: "student",
            },
          },
        ],
        responses: {
          200: ok("Library documents loaded"),
          500: error("Cannot load library documents"),
        },
      },
    },

    "/documents/view/{documentId}": {
      get: {
        tags: ["Documents"],
        summary: "Redirect to Cloudinary file URL",
        parameters: [idParam("documentId", "Document UUID")],
        responses: {
          302: {
            description: "Redirect to Cloudinary file",
          },
          404: error("Document or file URL not found"),
          500: error("Cannot view document"),
        },
      },
    },

    "/documents/download/{documentId}": {
      get: {
        tags: ["Documents"],
        summary: "Download document file",
        parameters: [idParam("documentId", "Document UUID")],
        responses: {
          200: {
            description: "File download",
            content: {
              "application/octet-stream": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          404: error("Document or file URL not found"),
          500: error("Cannot download document"),
        },
      },
    },

    "/documents/teacher-history": {
      get: {
        tags: ["Documents"],
        summary: "Get teacher upload history",
        parameters: [
          {
            name: "uploaderId",
            in: "query",
            required: false,
            schema: {
              type: "integer",
              example: 2,
            },
          },
        ],
        responses: {
          200: ok("Teacher upload history loaded"),
          500: error("Cannot load teacher upload history"),
        },
      },
    },

    "/documents/teacher-stats": {
      get: {
        tags: ["Documents"],
        summary: "Get teacher dashboard document statistics",
        responses: {
          200: ok("Teacher stats loaded"),
          500: error("Cannot load teacher stats"),
        },
      },
    },

    "/users/stats": {
      get: {
        tags: ["Users"],
        summary: "Get admin dashboard statistics",
        responses: {
          200: ok("User stats loaded"),
          500: error("Cannot load user stats"),
        },
      },
    },

    "/users": {
      get: {
        tags: ["Users"],
        summary: "Get all users",
        responses: {
          200: ok("Users loaded"),
          500: error("Cannot get users"),
        },
      },
    },

    "/users/{id}/status": {
      put: {
        tags: ["Users"],
        summary: "Update user status",
        parameters: [idParam("id", "User ID")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["active", "blocked", "pending"],
                    example: "active",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("User status updated"),
          500: error("Update status failed"),
        },
      },
    },

    "/users/{id}/role": {
      put: {
        tags: ["Users"],
        summary: "Update user role",
        parameters: [idParam("id", "User ID")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: {
                  role: {
                    type: "string",
                    enum: ["admin", "teacher", "student"],
                    example: "teacher",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("User role updated"),
          500: error("Update role failed"),
        },
      },
    },

    "/users/{id}/avatar": {
      post: {
        tags: ["Users"],
        summary: "Upload user avatar",
        parameters: [idParam("id", "User ID")],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["avatar"],
                properties: {
                  avatar: {
                    type: "string",
                    format: "binary",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Avatar updated successfully"),
          400: error("No avatar uploaded"),
          500: error("Upload avatar failed"),
        },
      },
    },

    "/users/{id}/profile": {
      get: {
        tags: ["Users"],
        summary: "Get user profile by ID",
        parameters: [idParam("id", "User ID")],
        responses: {
          200: ok("Profile loaded"),
          404: error("User not found"),
          500: error("Cannot load profile"),
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update user profile",
        parameters: [idParam("id", "User ID")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fullName", "email"],
                properties: {
                  fullName: {
                    type: "string",
                    example: "Nguyen Van A",
                  },
                  email: {
                    type: "string",
                    example: "student@gmail.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Profile updated successfully"),
          400: error("Full name/email required or email exists"),
          500: error("Update profile failed"),
        },
      },
    },

    "/users/{id}/password": {
      put: {
        tags: ["Users"],
        summary: "Change user password",
        parameters: [idParam("id", "User ID")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["currentPassword", "newPassword"],
                properties: {
                  currentPassword: {
                    type: "string",
                    example: "123456",
                  },
                  newPassword: {
                    type: "string",
                    example: "newpassword123",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Password changed successfully"),
          400: error("Invalid password request"),
          500: error("Change password failed"),
        },
      },
    },

    "/users/{id}": {
      delete: {
        tags: ["Users"],
        summary: "Delete user by ID",
        parameters: [idParam("id", "User ID")],
        responses: {
          200: ok("User deleted"),
          500: error("Delete user failed"),
        },
      },
    },

    "/chat-history/sessions/{userId}": {
      get: {
        tags: ["Chat History"],
        summary: "Get chat sessions by userId",
        parameters: [idParam("userId", "User ID")],
        responses: {
          200: ok("Chat sessions loaded"),
          500: error("Cannot load chat sessions"),
        },
      },
    },

    "/chat-history/sessions": {
      post: {
        tags: ["Chat History"],
        summary: "Create chat session",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId"],
                properties: {
                  userId: {
                    type: "integer",
                    example: 1,
                  },
                  documentId: {
                    type: "string",
                    nullable: true,
                    example: "document-uuid",
                  },
                  title: {
                    type: "string",
                    example: "New Chat",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Session created"),
          400: error("Missing userId"),
          500: error("Cannot create chat session"),
        },
      },
    },

    "/chat-history/sessions/{sessionId}": {
      put: {
        tags: ["Chat History"],
        summary: "Update chat session",
        parameters: [idParam("sessionId", "Session ID")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  documentId: {
                    type: "string",
                    nullable: true,
                    example: "document-uuid",
                  },
                  title: {
                    type: "string",
                    example: "New Chat",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Session updated"),
          500: error("Cannot update session"),
        },
      },
      delete: {
        tags: ["Chat History"],
        summary: "Delete chat session",
        parameters: [idParam("sessionId", "Session ID")],
        responses: {
          200: ok("Session deleted"),
          500: error("Cannot delete session"),
        },
      },
    },

    "/chat-history/messages/{sessionId}": {
      get: {
        tags: ["Chat History"],
        summary: "Get chat messages by sessionId",
        parameters: [idParam("sessionId", "Session ID")],
        responses: {
          200: ok("Chat messages loaded"),
          500: error("Cannot load chat messages"),
        },
      },
    },

    "/chat-history/messages": {
      post: {
        tags: ["Chat History"],
        summary: "Save chat message",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["sessionId", "sender", "message"],
                properties: {
                  sessionId: {
                    type: "integer",
                    example: 1,
                  },
                  sender: {
                    type: "string",
                    enum: ["user", "ai", "system"],
                    example: "user",
                  },
                  message: {
                    type: "string",
                    example: "Nội dung câu hỏi",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Message saved"),
          400: error("Missing sessionId, sender or message"),
          500: error("Cannot save message"),
        },
      },
    },

    "/feedback/submissions": {
      get: {
        tags: ["Feedback"],
        summary: "Get student submissions with latest feedback",
        responses: {
          200: ok("Student submissions loaded"),
          500: error("Cannot load student submissions"),
        },
      },
    },

    "/feedback/generate": {
      post: {
        tags: ["Feedback"],
        summary: "Generate AI feedback for a student based on chat history",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "documentId"],
                properties: {
                  studentId: {
                    type: "integer",
                    example: 3,
                  },
                  teacherId: {
                    type: "integer",
                    example: 2,
                  },
                  documentId: {
                    type: "string",
                    example: "document-uuid",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("Feedback generated"),
          400: error("Missing studentId or documentId"),
          404: error("Student or document not found"),
          500: error("Generate feedback failed"),
        },
      },
    },

    "/feedback/ask": {
      post: {
        tags: ["Feedback"],
        summary: "Teacher asks AI about a student's feedback and chat history",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["studentId", "documentId", "question"],
                properties: {
                  studentId: {
                    type: "integer",
                    example: 3,
                  },
                  documentId: {
                    type: "string",
                    example: "document-uuid",
                  },
                  question: {
                    type: "string",
                    example: "Học sinh này yếu phần nào?",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: ok("AI feedback answer"),
          400: error("Missing studentId, documentId or question"),
          404: error("Submission not found"),
          500: error("Ask feedback failed"),
        },
      },
    },

    "/notifications/{userId}": {
      get: {
        tags: ["Notifications"],
        summary: "Get notifications by userId",
        parameters: [idParam("userId", "User ID")],
        responses: {
          200: ok("Notifications loaded"),
          500: error("Cannot load notifications"),
        },
      },
    },

    "/notifications/{userId}/unread-count": {
      get: {
        tags: ["Notifications"],
        summary: "Get unread notification count by userId",
        parameters: [idParam("userId", "User ID")],
        responses: {
          200: ok("Unread count loaded"),
          500: error("Cannot load unread count"),
        },
      },
    },

    "/notifications/{notificationId}/read": {
      put: {
        tags: ["Notifications"],
        summary: "Mark notification as read",
        parameters: [idParam("notificationId", "Notification ID")],
        responses: {
          200: ok("Notification marked as read"),
          500: error("Cannot mark notification as read"),
        },
      },
    },

    "/notifications/user/{userId}/read-all": {
      put: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read by userId",
        parameters: [idParam("userId", "User ID")],
        responses: {
          200: ok("All notifications marked as read"),
          500: error("Cannot mark all notifications as read"),
        },
      },
    },
  },
};

export default swaggerSpec;