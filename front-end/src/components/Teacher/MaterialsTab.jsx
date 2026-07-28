import { useEffect, useMemo, useRef, useState } from "react";

import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Table from "react-bootstrap/Table";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Dropdown from "react-bootstrap/Dropdown";
import Toast from "react-bootstrap/Toast";
import ToastContainer from "react-bootstrap/ToastContainer";

import {
  uploadTeacherFile,
  getTeacherUploadHistory,
  deleteDocument,
  getMetadata,
  createSubject,
  createTopic,
} from "../../services/api";

const getCurrentUser = () => {
  try {
    const raw =
      sessionStorage.getItem("currentUser") ||
      localStorage.getItem("currentUser");

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getFileType = (
  fileName = "",
  fileType = "",
) => {
  const lowerName = String(
    fileName || "",
  ).toLowerCase();

  const lowerType = String(
    fileType || "",
  ).toLowerCase();

  if (
    lowerName.endsWith(".pdf") ||
    lowerType.includes("pdf")
  ) {
    return "pdf";
  }

  if (
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerType.includes("word")
  ) {
    return "docx";
  }

  return "other";
};

const fileIcon = (type) => {
  if (type === "pdf") {
    return {
      cls: "td-file-icon--pdf",
      icon: "bi bi-file-earmark-pdf",
      label: "PDF",
    };
  }

  if (type === "docx") {
    return {
      cls: "td-file-icon--docx",
      icon: "bi bi-file-earmark-word",
      label: "DOCX",
    };
  }

  return {
    cls: "td-file-icon--docx",
    icon: "bi bi-file-earmark-text",
    label: "FILE",
  };
};

const formatDate = (date) => {
  if (!date) return "-";

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return "-";
  }

  return value
    .toISOString()
    .split("T")[0];
};

const defaultUploadMeta = {
  subjectId: "",
  topicId: "",
  documentTypeId: "",
  levelId: "",
  tags: "",
  summary: "",
};

const defaultNewSubject = {
  subjectCode: "",
  subjectName: "",
  description: "",
};

const defaultNewTopic = {
  subjectId: "",
  topicName: "",
  description: "",
};

const splitTags = (value = "") => {
  return String(value || "")
    .split(/[\n,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const joinTags = (tags = []) => {
  const normalized = tags
    .map((tag) =>
      String(tag || "").trim(),
    )
    .filter(Boolean);

  return [
    ...new Set(normalized),
  ].join(", ");
};

const TagInput = ({
  value,
  onChange,
  placeholder = "Add tag...",
}) => {
  const [input, setInput] =
    useState("");

  const tags = useMemo(
    () => splitTags(value),
    [value],
  );

  const addTags = (
    rawValue = "",
  ) => {
    const nextTags =
      splitTags(rawValue);

    if (nextTags.length === 0) {
      return;
    }

    onChange(
      joinTags([
        ...tags,
        ...nextTags,
      ]),
    );

    setInput("");
  };

  const removeTag = (
    tagToRemove,
  ) => {
    onChange(
      joinTags(
        tags.filter(
          (tag) =>
            tag !== tagToRemove,
        ),
      ),
    );
  };

  const handleKeyDown = (
    event,
  ) => {
    if (
      ["Enter", "Tab", ","].includes(
        event.key,
      )
    ) {
      event.preventDefault();
      addTags(input);
      return;
    }

    if (
      event.key === "Backspace" &&
      !input &&
      tags.length > 0
    ) {
      removeTag(
        tags[tags.length - 1],
      );
    }
  };

  const handlePaste = (
    event,
  ) => {
    const text =
      event.clipboardData.getData(
        "text",
      );

    if (
      text.includes(",") ||
      text.includes("\n")
    ) {
      event.preventDefault();
      addTags(text);
    }
  };

  return (
    <div
      className="tag-select-input"
      onClick={(event) => {
        const inputElement =
          event.currentTarget.querySelector(
            "input",
          );

        inputElement?.focus();
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="tag-select-chip"
        >
          {tag}

          <button
            type="button"
            className="tag-select-remove"
            aria-label={`Remove ${tag}`}
            onClick={(event) => {
              event.stopPropagation();
              removeTag(tag);
            }}
          >
            ×
          </button>
        </span>
      ))}

      <input
        className="tag-select-control"
        value={input}
        placeholder={
          tags.length === 0
            ? placeholder
            : ""
        }
        onChange={(event) =>
          setInput(
            event.target.value,
          )
        }
        onKeyDown={handleKeyDown}
        onBlur={() => addTags(input)}
        onPaste={handlePaste}
      />
    </div>
  );
};

const PAGE_SIZE = 10;

const buildPaginationItems = (
  currentPage,
  totalPages,
) => {
  if (totalPages <= 7) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1,
    );
  }

  const items = [1];

  let start = Math.max(
    2,
    currentPage - 1,
  );

  let end = Math.min(
    totalPages - 1,
    currentPage + 1,
  );

  if (currentPage <= 4) {
    start = 2;
    end = Math.min(
      5,
      totalPages - 1,
    );
  }

  if (
    currentPage >=
    totalPages - 3
  ) {
    start = Math.max(
      2,
      totalPages - 4,
    );

    end = totalPages - 1;
  }

  if (start > 2) {
    items.push("left-ellipsis");
  }

  for (
    let pageNumber = start;
    pageNumber <= end;
    pageNumber += 1
  ) {
    items.push(pageNumber);
  }

  if (end < totalPages - 1) {
    items.push("right-ellipsis");
  }

  items.push(totalPages);

  return items;
};

const getToastIcon = (type) => {
  if (type === "success") {
    return "bi bi-check-circle-fill";
  }

  if (type === "error") {
    return "bi bi-x-circle-fill";
  }

  if (type === "warning") {
    return "bi bi-exclamation-triangle-fill";
  }

  return "bi bi-info-circle-fill";
};

export default function MaterialsTab() {
  const fileRef = useRef(null);

  const [docs, setDocs] =
    useState([]);

  const [page, setPage] =
    useState(1);

  const [jumpPage, setJumpPage] =
    useState("");

  const [uploading, setUploading] =
    useState(false);

  const [dragging, setDragging] =
    useState(false);

  const [
    showUploadModal,
    setShowUploadModal,
  ] = useState(false);

  const [
    pendingFile,
    setPendingFile,
  ] = useState(null);

  const [subjects, setSubjects] =
    useState([]);

  const [topics, setTopics] =
    useState([]);

  const [
    documentTypes,
    setDocumentTypes,
  ] = useState([]);

  const [
    documentLevels,
    setDocumentLevels,
  ] = useState([]);

  const [
    uploadMeta,
    setUploadMeta,
  ] = useState(defaultUploadMeta);

  const [
    newSubject,
    setNewSubject,
  ] = useState(defaultNewSubject);

  const [newTopic, setNewTopic] =
    useState(defaultNewTopic);

  const [toast, setToast] =
    useState({
      id: 0,
      show: false,
      type: "info",
      title: "",
      message: "",
      actions: [],
      delay: 4000,
    });

  const currentUser =
    getCurrentUser();

  const showToast = ({
    type = "info",
    title = "Thông báo",
    message = "",
    actions = [],
    delay = 4000,
  }) => {
    setToast({
      id: Date.now(),
      show: true,
      type,
      title,
      message,
      actions,
      delay,
    });
  };

  const hideToast = () => {
    setToast((previous) => ({
      ...previous,
      show: false,
    }));
  };

  const filteredTopics =
    useMemo(() => {
      if (!uploadMeta.subjectId) {
        return topics;
      }

      return topics.filter(
        (topic) =>
          String(topic.subjectId) ===
          String(
            uploadMeta.subjectId,
          ),
      );
    }, [
      topics,
      uploadMeta.subjectId,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      docs.length / PAGE_SIZE,
    ),
  );

  const safePage = Math.min(
    page,
    totalPages,
  );

  const startIndex =
    (safePage - 1) * PAGE_SIZE;

  const paginatedDocs =
    docs.slice(
      startIndex,
      startIndex + PAGE_SIZE,
    );

  const paginationItems =
    buildPaginationItems(
      safePage,
      totalPages,
    );

  useEffect(() => {
    setPage((currentPage) =>
      Math.min(
        currentPage,
        totalPages,
      ),
    );
  }, [totalPages]);

  const fetchUploadHistory =
    async () => {
      try {
        const data =
          await getTeacherUploadHistory(
            currentUser?.userId,
          );

        if (data.success) {
          setDocs(data.data || []);
        }
      } catch (error) {
        console.error(error);

        showToast({
          type: "error",
          title:
            "Không thể tải lịch sử",
          message:
            error.message ||
            "Cannot load upload history.",
          delay: 5000,
        });
      }
    };

  const fetchMetadata =
    async () => {
      try {
        const data =
          await getMetadata();

        if (!data.success) return;

        const loadedSubjects =
          data.subjects || [];

        const loadedTopics =
          data.topics || [];

        const loadedTypes =
          data.documentTypes || [];

        const loadedLevels =
          data.documentLevels || [];

        setSubjects(
          loadedSubjects,
        );

        setTopics(loadedTopics);

        setDocumentTypes(
          loadedTypes,
        );

        setDocumentLevels(
          loadedLevels,
        );

        setUploadMeta(
          (previous) => ({
            ...previous,

            documentTypeId:
              previous.documentTypeId ||
              loadedTypes[0]
                ?.documentTypeId ||
              "",

            levelId:
              previous.levelId ||
              loadedLevels[0]
                ?.levelId ||
              "",
          }),
        );

        setNewTopic(
          (previous) => ({
            ...previous,

            subjectId:
              previous.subjectId ||
              loadedSubjects[0]
                ?.subjectId ||
              "",
          }),
        );
      } catch (error) {
        console.error(error);

        showToast({
          type: "error",
          title:
            "Không thể tải metadata",
          message:
            error.message ||
            "Cannot load metadata.",
          delay: 5000,
        });
      }
    };

  useEffect(() => {
    fetchMetadata();
    fetchUploadHistory();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!uploadMeta.subjectId) {
      return;
    }

    const stillValid =
      filteredTopics.some(
        (topic) =>
          String(topic.topicId) ===
          String(
            uploadMeta.topicId,
          ),
      );

    if (!stillValid) {
      setUploadMeta(
        (previous) => ({
          ...previous,
          topicId: "",
        }),
      );
    }
  }, [
    uploadMeta.subjectId,
    uploadMeta.topicId,
    filteredTopics,
  ]);

  const goToPage = () => {
    const pageNumber =
      Number(jumpPage);

    if (
      !Number.isInteger(
        pageNumber,
      ) ||
      pageNumber < 1 ||
      pageNumber > totalPages
    ) {
      showToast({
        type: "warning",
        title:
          "Số trang không hợp lệ",
        message: `Please enter a page number from 1 to ${totalPages}.`,
      });

      return;
    }

    setPage(pageNumber);
    setJumpPage("");
  };

  const validateFile = (
    file,
  ) => {
    const name =
      file.name.toLowerCase();

    if (
      !name.endsWith(".pdf") &&
      !name.endsWith(".docx") &&
      !name.endsWith(".doc")
    ) {
      return "Only PDF, DOC and DOCX files are allowed.";
    }

    return "";
  };

  const openUploadModal =
    async (file) => {
      if (!file) return;

      const validateMessage =
        validateFile(file);

      if (validateMessage) {
        showToast({
          type: "error",
          title:
            "File không hợp lệ",
          message:
            validateMessage,
        });

        return;
      }

      await fetchMetadata();

      setPendingFile(file);

      setUploadMeta({
        ...defaultUploadMeta,

        documentTypeId:
          documentTypes[0]
            ?.documentTypeId ||
          "",

        levelId:
          documentLevels[0]
            ?.levelId ||
          "",
      });

      setShowUploadModal(true);
    };

  const closeUploadModal = (
    force = false,
  ) => {
    if (
      uploading &&
      !force
    ) {
      return;
    }

    setShowUploadModal(false);
    setPendingFile(null);

    setUploadMeta(
      defaultUploadMeta,
    );

    if (fileRef.current) {
      fileRef.current.value =
        "";
    }
  };

  const handleOpenPendingFile = (
    file,
  ) => {
    if (!file) return;

    const fileUrl =
      URL.createObjectURL(file);

    window.open(
      fileUrl,
      "_blank",
      "noopener,noreferrer",
    );

    window.setTimeout(() => {
      URL.revokeObjectURL(
        fileUrl,
      );
    }, 30000);
  };

  const uploadWithMeta = async (
    extraOptions = {},
  ) => {
    if (!pendingFile) {
      throw new Error(
        "No pending file selected.",
      );
    }

    if (!currentUser?.userId) {
      throw new Error(
        "Teacher account not found.",
      );
    }

    return uploadTeacherFile(
      pendingFile,
      currentUser.userId,
      {
        ...uploadMeta,
        ...extraOptions,
      },
    );
  };

  const handleDuplicateUpload =
    async (
      duplicateData,
      duplicateAction,
    ) => {
      hideToast();
      setUploading(true);

      try {
        const data =
          await uploadWithMeta({
            duplicateAction,

            replaceDocumentId:
              duplicateData
                .existingDocumentId,

            allowVersion:
              duplicateAction ===
              "new_version",
          });

        if (!data.success) {
          throw new Error(
            data.error ||
            data.message ||
            "Upload failed.",
          );
        }

        await fetchUploadHistory();

        showToast({
          type: "success",

          title:
            duplicateAction ===
            "new_version"
              ? `Đã tạo Version ${
                  data.versionNo ||
                  duplicateData.nextVersion ||
                  2
                }`
              : "Đã thay thế tài liệu",

          message:
            data.message ||
            "Tài liệu đã được cập nhật.",
        });

        closeUploadModal(true);
      } catch (error) {
        console.error(error);

        showToast({
          type: "error",
          title:
            "Upload thất bại",
          message:
            error.message ||
            "Không thể tải tài liệu lên.",
          delay: 5000,
        });
      } finally {
        setUploading(false);
      }
    };

  const handleConfirmUpload =
    async () => {
      if (!pendingFile) return;

      setUploading(true);

      let preservePendingFile =
        false;

      try {
        const data =
          await uploadWithMeta();

        if (data.needConfirm) {
          preservePendingFile = true;

          const nextVersion =
            Number(
              data.nextVersion,
            ) || 2;

          const isPublicDuplicate =
            data.duplicateType ===
            "public";

          const canReplace =
            data.canReplace !==
              false &&
            !isPublicDuplicate;

          const actions = [
            {
              label: "Hủy",
              className:
                "td-toast-action td-toast-action--secondary",
              onClick: hideToast,
            },

            {
              label: `Tạo Version ${nextVersion}`,
              className:
                "td-toast-action td-toast-action--primary",
              onClick: () =>
                handleDuplicateUpload(
                  data,
                  "new_version",
                ),
            },
          ];

          if (canReplace) {
            actions.push({
              label:
                "Thay thế file cũ",

              className:
                "td-toast-action td-toast-action--danger",

              onClick: () =>
                handleDuplicateUpload(
                  data,
                  "replace_old",
                ),
            });
          }

          showToast({
            type: "warning",
            title:
              "Tài liệu đã tồn tại",

            message:
              data.message ||
              "Hãy chọn cách tiếp tục với tài liệu này.",

            actions,

            delay: 0,
          });

          return;
        }

        if (!data.success) {
          throw new Error(
            data.error ||
            data.message ||
            "Upload failed.",
          );
        }

        await fetchUploadHistory();

        showToast({
          type: "success",
          title:
            "Upload thành công",

          message:
            data.message ||
            "Tài liệu đã được tải lên.",
        });

        closeUploadModal(true);
      } catch (error) {
        console.error(error);

        showToast({
          type: "error",
          title:
            "Upload thất bại",
          message:
            error.message ||
            "Cannot connect to server.",
          delay: 5000,
        });
      } finally {
        setUploading(false);

        if (
          !preservePendingFile &&
          fileRef.current
        ) {
          fileRef.current.value =
            "";
        }
      }
    };

  const handleFileChange = (
    event,
  ) => {
    const file =
      event.target.files?.[0];

    openUploadModal(file);
  };

  const handleDrop = (
    event,
  ) => {
    event.preventDefault();
    setDragging(false);

    const file =
      event.dataTransfer
        .files?.[0];

    openUploadModal(file);
  };

  const getDocumentUrl = (
    file,
  ) => {
    if (!file?.fileUrl) {
      return "";
    }

    return file.fileUrl;
  };

  const handleView = (file) => {
    const url =
      getDocumentUrl(file);

    if (!url) {
      showToast({
        type: "error",
        title:
          "Không thể mở tài liệu",
        message:
          "File này chưa có URL để xem. Hãy upload lại file.",
      });

      return;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const confirmDeleteDocument =
    async (documentId) => {
      hideToast();

      try {
        const data =
          await deleteDocument(
            documentId,
          );

        if (!data.success) {
          throw new Error(
            data.message ||
            "Delete failed.",
          );
        }

        setDocs((previous) =>
          previous.filter(
            (document) =>
              String(
                document.documentId,
              ) !==
              String(documentId),
          ),
        );

        showToast({
          type: "success",
          title:
            "Đã xóa tài liệu",
          message:
            "Tài liệu đã được xóa khỏi danh sách.",
        });
      } catch (error) {
        console.error(error);

        showToast({
          type: "error",
          title:
            "Xóa thất bại",
          message:
            error.message ||
            "Cannot delete document.",
          delay: 5000,
        });
      }
    };

  const handleDelete = (
    documentId,
  ) => {
    const document =
      docs.find(
        (item) =>
          String(
            item.documentId,
          ) ===
          String(documentId),
      );

    showToast({
      type: "warning",
      title: "Xóa tài liệu?",

      message:
        document?.fileName
          ? `Bạn chắc chắn muốn xóa "${document.fileName}"?`
          : "Bạn chắc chắn muốn xóa tài liệu này?",

      actions: [
        {
          label: "Hủy",
          className:
            "td-toast-action td-toast-action--secondary",
          onClick: hideToast,
        },

        {
          label:
            "Xóa tài liệu",
          className:
            "td-toast-action td-toast-action--danger",

          onClick: () =>
            confirmDeleteDocument(
              documentId,
            ),
        },
      ],

      delay: 0,
    });
  };

  const handleCreateSubject =
    async (event) => {
      event.preventDefault();

      if (
        !newSubject.subjectName.trim()
      ) {
        showToast({
          type: "warning",
          title:
            "Thiếu tên môn học",
          message:
            "Subject name is required.",
        });

        return;
      }

      try {
        const result =
          await createSubject({
            ...newSubject,
            createdBy:
              currentUser?.userId,
          });

        setNewSubject(
          defaultNewSubject,
        );

        await fetchMetadata();

        if (result.subjectId) {
          setUploadMeta(
            (previous) => ({
              ...previous,
              subjectId:
                result.subjectId,
              topicId: "",
            }),
          );

          setNewTopic(
            (previous) => ({
              ...previous,
              subjectId:
                result.subjectId,
            }),
          );
        }

        showToast({
          type: "success",
          title:
            "Đã tạo môn học",
          message:
            "Subject created successfully.",
        });
      } catch (error) {
        showToast({
          type: "error",
          title:
            "Không thể tạo môn học",
          message:
            error.message ||
            "Cannot create subject.",
        });
      }
    };

  const handleCreateTopic =
    async (event) => {
      event.preventDefault();

      const subjectIdForTopic =
        newTopic.subjectId ||
        uploadMeta.subjectId;

      if (
        !subjectIdForTopic ||
        !newTopic.topicName.trim()
      ) {
        showToast({
          type: "warning",
          title:
            "Thiếu thông tin",
          message:
            "Subject and topic name are required.",
        });

        return;
      }

      try {
        const result =
          await createTopic({
            ...newTopic,
            subjectId:
              subjectIdForTopic,
            createdBy:
              currentUser?.userId,
          });

        setNewTopic(
          (previous) => ({
            ...previous,
            topicName: "",
            description: "",
          }),
        );

        await fetchMetadata();

        if (result.topicId) {
          setUploadMeta(
            (previous) => ({
              ...previous,
              subjectId:
                subjectIdForTopic,
              topicId:
                result.topicId,
            }),
          );
        }

        showToast({
          type: "success",
          title:
            "Đã tạo chủ đề",
          message:
            "Topic created successfully.",
        });
      } catch (error) {
        showToast({
          type: "error",
          title:
            "Không thể tạo chủ đề",
          message:
            error.message ||
            "Cannot create topic.",
        });
      }
    };

  return (
    <>
      <style>
        {`
          .td-toast-container {
            position: fixed !important;
            top: 24px !important;
            right: 24px !important;
            z-index: 30000 !important;
            width: auto !important;
            padding: 0 !important;
          }

          .td-toast {
            position: relative;
            width: min(440px, calc(100vw - 32px));
            overflow: hidden;
            border: 0 !important;
            border-radius: 18px !important;
            background: #ffffff !important;
            box-shadow:
              0 24px 60px rgba(15, 23, 42, 0.18),
              0 8px 20px rgba(15, 23, 42, 0.10) !important;
          }

          .td-toast::before {
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            width: 5px;
            content: "";
          }

          .td-toast--success::before {
            background: #16a34a;
          }

          .td-toast--error::before {
            background: #dc2626;
          }

          .td-toast--warning::before {
            background: #f59e0b;
          }

          .td-toast--info::before {
            background: #2563eb;
          }

          .td-toast__header {
            display: flex;
            gap: 10px;
            align-items: center;
            padding: 16px 18px 8px 20px !important;
            border: 0 !important;
            background: transparent !important;
          }

          .td-toast__icon {
            display: grid;
            flex: 0 0 34px;
            width: 34px;
            height: 34px;
            place-items: center;
            border-radius: 11px;
            font-size: 17px;
          }

          .td-toast--success .td-toast__icon {
            color: #15803d;
            background: #dcfce7;
          }

          .td-toast--error .td-toast__icon {
            color: #dc2626;
            background: #fee2e2;
          }

          .td-toast--warning .td-toast__icon {
            color: #d97706;
            background: #fef3c7;
          }

          .td-toast--info .td-toast__icon {
            color: #2563eb;
            background: #dbeafe;
          }

          .td-toast__title {
            flex: 1;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
          }

          .td-toast__body {
            padding: 4px 18px 18px 64px !important;
            color: #475569;
          }

          .td-toast__message {
            font-size: 13px;
            line-height: 1.55;
            white-space: pre-line;
          }

          .td-toast__actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
          }

          .td-toast-action {
            min-height: 36px;
            padding: 8px 13px;
            border: 0;
            border-radius: 10px;
            font-size: 12px;
            font-weight: 700;
            transition:
              transform 0.15s ease,
              box-shadow 0.15s ease,
              background 0.15s ease;
          }

          .td-toast-action:hover:not(:disabled) {
            transform: translateY(-1px);
          }

          .td-toast-action:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }

          .td-toast-action--secondary {
            color: #475569;
            background: #f1f5f9;
          }

          .td-toast-action--primary {
            color: #ffffff;
            background: #2563eb;
            box-shadow: 0 7px 16px rgba(37, 99, 235, 0.22);
          }

          .td-toast-action--danger {
            color: #ffffff;
            background: #dc2626;
            box-shadow: 0 7px 16px rgba(220, 38, 38, 0.20);
          }

          .td-materials-version-badge {
            display: inline-flex;
            min-width: 76px;
            align-items: center;
            justify-content: center;
            gap: 5px;
            padding: 5px 10px;
            border: 1px solid #c7d2fe;
            border-radius: 999px;
            color: #4338ca;
            background: #eef2ff;
            font-size: 11px;
            font-weight: 750;
            white-space: nowrap;
          }

          @media (max-width: 576px) {
            .td-toast-container {
              top: 12px !important;
              right: 12px !important;
              left: 12px !important;
            }

            .td-toast {
              width: 100%;
            }

            .td-toast__body {
              padding-left: 20px !important;
            }

            .td-toast__actions {
              justify-content: stretch;
            }

            .td-toast-action {
              flex: 1;
            }
          }
        `}
      </style>

      <ToastContainer
        position="top-end"
        className="td-toast-container"
      >
        <Toast
          key={toast.id}
          show={toast.show}
          onClose={hideToast}
          autohide={
            toast.actions.length ===
            0
          }
          delay={toast.delay}
          className={`td-toast td-toast--${toast.type}`}
        >
          <Toast.Header
            className="td-toast__header"
          >
            <div className="td-toast__icon">
              <i
                className={getToastIcon(
                  toast.type,
                )}
              />
            </div>

            <strong className="td-toast__title">
              {toast.title}
            </strong>
          </Toast.Header>

          <Toast.Body className="td-toast__body">
            <div className="td-toast__message">
              {toast.message}
            </div>

            {toast.actions.length >
              0 && (
              <div className="td-toast__actions">
                {toast.actions.map(
                  (action) => (
                    <button
                      key={
                        action.label
                      }
                      type="button"
                      className={
                        action.className
                      }
                      onClick={
                        action.onClick
                      }
                      disabled={
                        uploading
                      }
                    >
                      {action.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      <Card
        className={`td-upload-zone border-0 ${
          dragging
            ? "td-upload-zone--active"
            : ""
        }`}
        onClick={() =>
          fileRef.current?.click()
        }
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() =>
          setDragging(false)
        }
        onDrop={handleDrop}
      >
        <Card.Body className="d-flex flex-column align-items-center gap-3 py-5">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="td-file-input-hidden"
            onChange={
              handleFileChange
            }
          />

          <div className="td-upload-icon">
            <i className="bi bi-upload" />
          </div>

          <Card.Text className="td-upload-text mb-0">
            Drop files here or click
            to browse
          </Card.Text>

          <Card.Text className="td-upload-hint mb-0">
            Metadata will be
            auto-filled after upload.
            You can edit it before
            uploading if needed.
          </Card.Text>

          <Button
            type="button"
            variant="primary"
            className="td-select-btn"
            disabled={uploading}
            onClick={(event) => {
              event.stopPropagation();
              fileRef.current?.click();
            }}
          >
            {uploading
              ? "Uploading..."
              : "Select File"}
          </Button>
        </Card.Body>
      </Card>

      <Modal
        show={showUploadModal}
        onHide={() =>
          closeUploadModal()
        }
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Document metadata
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-3">
            <div className="d-flex align-items-center justify-content-between gap-2">
              <p className="text-muted mb-0">
                File:{" "}
                <b>
                  {pendingFile?.name}
                </b>
              </p>

              <Button
                type="button"
                variant="outline-primary"
                size="sm"
                onClick={() =>
                  handleOpenPendingFile(
                    pendingFile,
                  )
                }
                disabled={!pendingFile}
              >
                <i className="bi bi-box-arrow-up-right me-1" />
                Open file
              </Button>
            </div>

            <p className="text-muted mb-0 mt-1">
              Leave fields empty to
              let the system auto-fill
              metadata.
            </p>
          </div>

          <Row className="g-3">
            <Col md={6}>
              <Form.Label>
                Subject / Môn học
              </Form.Label>

              <Form.Select
                value={
                  uploadMeta.subjectId
                }
                onChange={(event) =>
                  setUploadMeta(
                    (previous) => ({
                      ...previous,
                      subjectId:
                        event.target
                          .value,
                      topicId: "",
                    }),
                  )
                }
              >
                <option value="">
                  Select subject
                </option>

                {subjects.map(
                  (subject) => (
                    <option
                      key={
                        subject.subjectId
                      }
                      value={
                        subject.subjectId
                      }
                    >
                      {subject.subjectCode
                        ? `${subject.subjectCode} - ${subject.subjectName}`
                        : subject.subjectName}
                    </option>
                  ),
                )}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>
                Topic / Chủ đề
              </Form.Label>

              <Form.Select
                value={
                  uploadMeta.topicId
                }
                disabled={
                  !uploadMeta.subjectId
                }
                onChange={(event) =>
                  setUploadMeta(
                    (previous) => ({
                      ...previous,
                      topicId:
                        event.target
                          .value,
                    }),
                  )
                }
              >
                <option value="">
                  Select topic
                </option>

                {filteredTopics.map(
                  (topic) => (
                    <option
                      key={topic.topicId}
                      value={topic.topicId}
                    >
                      {topic.topicName}
                    </option>
                  ),
                )}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>
                Document Type
              </Form.Label>

              <Form.Select
                value={
                  uploadMeta.documentTypeId
                }
                onChange={(event) =>
                  setUploadMeta(
                    (previous) => ({
                      ...previous,

                      documentTypeId:
                        event.target
                          .value,
                    }),
                  )
                }
              >
                <option value="">
                  Select type
                </option>

                {documentTypes.map(
                  (type) => (
                    <option
                      key={
                        type.documentTypeId
                      }
                      value={
                        type.documentTypeId
                      }
                    >
                      {type.typeName}
                    </option>
                  ),
                )}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>
                Level
              </Form.Label>

              <Form.Select
                value={
                  uploadMeta.levelId
                }
                onChange={(event) =>
                  setUploadMeta(
                    (previous) => ({
                      ...previous,
                      levelId:
                        event.target
                          .value,
                    }),
                  )
                }
              >
                <option value="">
                  Select level
                </option>

                {documentLevels.map(
                  (level) => (
                    <option
                      key={level.levelId}
                      value={level.levelId}
                    >
                      {level.levelName}
                    </option>
                  ),
                )}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>
                Tags
              </Form.Label>

              <TagInput
                value={uploadMeta.tags}
                placeholder="Type a tag then press Enter, Tab, or comma"
                onChange={(tags) =>
                  setUploadMeta(
                    (previous) => ({
                      ...previous,
                      tags,
                    }),
                  )
                }
              />

              <Form.Text className="text-muted">
                Example: rag, chatbot,
                week 1.
              </Form.Text>
            </Col>

            <Col md={6}>
              <Form.Label>
                Tên/Ghi chú tài liệu
              </Form.Label>

              <Form.Control
                value={
                  uploadMeta.summary
                }
                placeholder="Ví dụ: Slide RAG tuần 1"
                onChange={(event) =>
                  setUploadMeta(
                    (previous) => ({
                      ...previous,
                      summary:
                        event.target
                          .value,
                    }),
                  )
                }
              />
            </Col>
          </Row>

          <hr />

          <div className="td-section-label mb-2">
            Teacher quick metadata
          </div>

          <p className="td-empty-text mb-3">
            Nếu chưa có môn học hoặc
            chủ đề, teacher có thể tạo
            nhanh tại đây rồi chọn để
            upload.
          </p>

          <Form
            onSubmit={
              handleCreateSubject
            }
            className="mb-3"
          >
            <Row className="g-2">
              <Col md={3}>
                <Form.Control
                  placeholder="Code"
                  value={
                    newSubject.subjectCode
                  }
                  onChange={(event) =>
                    setNewSubject(
                      (previous) => ({
                        ...previous,
                        subjectCode:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </Col>

              <Col md={6}>
                <Form.Control
                  placeholder="Subject name"
                  value={
                    newSubject.subjectName
                  }
                  onChange={(event) =>
                    setNewSubject(
                      (previous) => ({
                        ...previous,
                        subjectName:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </Col>

              <Col md={3}>
                <Button
                  type="submit"
                  className="w-100"
                  disabled={uploading}
                >
                  Add Subject
                </Button>
              </Col>
            </Row>
          </Form>

          <Form
            onSubmit={
              handleCreateTopic
            }
          >
            <Row className="g-2">
              <Col md={3}>
                <Form.Select
                  value={
                    newTopic.subjectId ||
                    uploadMeta.subjectId
                  }
                  onChange={(event) =>
                    setNewTopic(
                      (previous) => ({
                        ...previous,
                        subjectId:
                          event.target
                            .value,
                      }),
                    )
                  }
                >
                  <option value="">
                    Subject
                  </option>

                  {subjects.map(
                    (subject) => (
                      <option
                        key={
                          subject.subjectId
                        }
                        value={
                          subject.subjectId
                        }
                      >
                        {subject.subjectCode ||
                          subject.subjectName}
                      </option>
                    ),
                  )}
                </Form.Select>
              </Col>

              <Col md={6}>
                <Form.Control
                  placeholder="Topic name"
                  value={
                    newTopic.topicName
                  }
                  onChange={(event) =>
                    setNewTopic(
                      (previous) => ({
                        ...previous,
                        topicName:
                          event.target
                            .value,
                      }),
                    )
                  }
                />
              </Col>

              <Col md={3}>
                <Button
                  type="submit"
                  className="w-100"
                  disabled={uploading}
                >
                  Add Topic
                </Button>
              </Col>
            </Row>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            disabled={uploading}
            onClick={() =>
              closeUploadModal()
            }
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            disabled={uploading}
            onClick={
              handleConfirmUpload
            }
          >
            {uploading
              ? "Uploading..."
              : "Upload"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Card className="td-card td-materials-history-card mt-3">
        <Card.Body>
          <div className="td-materials-table-title">
            Upload History
          </div>

          <div className="td-materials-table-wrap">
            <Table
              className="td-materials-table"
              borderless
            >
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>METADATA</th>
                  <th>VERSION</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                  <th>UPLOADED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {docs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="td-materials-empty"
                    >
                      No uploaded files yet.
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map(
                    (file) => {
                      const type =
                        getFileType(
                          file.fileName,
                          file.fileType,
                        );

                      const {
                        cls,
                        icon,
                        label,
                      } = fileIcon(type);

                      const normalizedStatus =
                        String(
                          file.reviewStatus ||
                            "approved",
                        ).toLowerCase();

                      const statusLabel =
                        normalizedStatus ===
                        "approved"
                          ? "Public"
                          : normalizedStatus ===
                              "private"
                            ? "Private"
                            : normalizedStatus ===
                                "pending"
                              ? "Pending"
                              : normalizedStatus ===
                                  "rejected"
                                ? "Rejected"
                                : file.reviewStatus ||
                                  "Unknown";

                      const versionNumber =
                        Math.max(
                          1,
                          Number(
                            file.versionNo,
                          ) || 1,
                        );

                      return (
                        <tr
                          key={
                            file.documentId
                          }
                        >
                          <td>
                            <div className="td-materials-name-cell">
                              <div
                                className={`td-file-icon ${cls}`}
                              >
                                <i
                                  className={
                                    icon
                                  }
                                />
                              </div>

                              <div className="td-materials-name-info">
                                <div
                                  className="td-materials-file-name"
                                  title={
                                    file.fileName
                                  }
                                >
                                  {
                                    file.fileName
                                  }
                                </div>

                                <div
                                  className="td-materials-file-note"
                                  title={
                                    file.summary ||
                                    file.documentTypeName ||
                                    label
                                  }
                                >
                                  {file.summary ||
                                    file.documentTypeName ||
                                    label}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div
                              className="td-materials-subject"
                              title={
                                file.subjectName
                                  ? `${file.subjectCode || ""} ${file.subjectName}`.trim()
                                  : file.subjectCode ||
                                    "No Subject"
                              }
                            >
                              {file.subjectCode ||
                                "No Subject"}

                              {file.subjectName
                                ? ` - ${file.subjectName}`
                                : ""}
                            </div>

                            <div
                              className="td-materials-meta-line"
                              title={`${file.topicName || "Uncategorized"} · ${
                                file.documentTypeName ||
                                "No Type"
                              } · ${
                                file.levelName ||
                                "No Level"
                              }`}
                            >
                              {file.topicName ||
                                "Uncategorized"}{" "}
                              ·{" "}
                              {file.documentTypeName ||
                                "No Type"}{" "}
                              ·{" "}
                              {file.levelName ||
                                "No Level"}
                            </div>

                            {file.tags ? (
                              <div
                                className="td-materials-tags"
                                title={
                                  file.tags
                                }
                              >
                                Tags:{" "}
                                {file.tags}
                              </div>
                            ) : null}
                          </td>

                          <td>
                            <span
                              className="td-materials-version-badge"
                              title={`Document version ${versionNumber}`}
                            >
                              <i className="bi bi-layers" />
                              Version{" "}
                              {versionNumber}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`td-materials-type-badge td-materials-type-badge--${type}`}
                            >
                              {label}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`td-materials-status-badge td-materials-status-badge--${normalizedStatus}`}
                            >
                              {statusLabel}
                            </span>
                          </td>

                          <td className="td-materials-date">
                            {formatDate(
                              file.uploadDate,
                            )}
                          </td>

                          <td>
                            <Dropdown
                              align="end"
                              className="td-materials-actions-dropdown"
                            >
                              <Dropdown.Toggle
                                variant="light"
                                className="td-materials-actions-toggle"
                                id={`material-actions-${file.documentId}`}
                                aria-label={`Actions for ${file.fileName}`}
                              >
                                <i className="bi bi-three-dots" />
                              </Dropdown.Toggle>

                              <Dropdown.Menu
                                className="td-materials-actions-menu"
                                popperConfig={{
                                  strategy:
                                    "fixed",
                                }}
                              >
                                <Dropdown.Item
                                  as="button"
                                  type="button"
                                  onClick={() =>
                                    handleView(
                                      file,
                                    )
                                  }
                                  disabled={
                                    !file.fileUrl
                                  }
                                >
                                  <i className="bi bi-eye td-materials-menu-icon td-materials-menu-icon--view" />
                                  <span>
                                    Open
                                    document
                                  </span>
                                </Dropdown.Item>

                                <Dropdown.Divider />

                                <Dropdown.Item
                                  as="button"
                                  type="button"
                                  className="td-materials-menu-delete"
                                  onClick={() =>
                                    handleDelete(
                                      file.documentId,
                                    )
                                  }
                                >
                                  <i className="bi bi-trash3 td-materials-menu-icon" />
                                  <span>
                                    Delete
                                    document
                                  </span>
                                </Dropdown.Item>
                              </Dropdown.Menu>
                            </Dropdown>
                          </td>
                        </tr>
                      );
                    },
                  )
                )}
              </tbody>
            </Table>
          </div>

          {docs.length >
            PAGE_SIZE && (
            <div className="td-pagination td-pagination--pill">
              <div className="td-pagination__controls">
                <button
                  type="button"
                  className="td-page-btn td-page-btn--text"
                  disabled={
                    safePage === 1
                  }
                  onClick={() =>
                    setPage(
                      (previous) =>
                        Math.max(
                          1,
                          previous - 1,
                        ),
                    )
                  }
                >
                  <i className="bi bi-chevron-left" />
                  Previous
                </button>

                <div className="td-page-numbers">
                  {paginationItems.map(
                    (item) => {
                      if (
                        typeof item ===
                        "number"
                      ) {
                        return (
                          <button
                            type="button"
                            key={item}
                            className={`td-page-btn ${
                              safePage ===
                              item
                                ? "td-page-btn--active"
                                : ""
                            }`}
                            onClick={() =>
                              setPage(
                                item,
                              )
                            }
                          >
                            {item}
                          </button>
                        );
                      }

                      return (
                        <Dropdown
                          key={item}
                          autoClose="outside"
                          className="td-page-jump-dropdown"
                        >
                          <Dropdown.Toggle
                            variant="light"
                            className="td-page-btn td-page-btn--ellipsis"
                            id={`material-${item}`}
                            aria-label="Go to another page"
                          >
                            <i className="bi bi-three-dots" />
                          </Dropdown.Toggle>

                          <Dropdown.Menu className="td-page-jump-menu">
                            <div className="td-page-jump-title">
                              Go to page
                            </div>

                            <div className="td-page-jump-form">
                              <Form.Control
                                type="number"
                                min={1}
                                max={
                                  totalPages
                                }
                                value={
                                  jumpPage
                                }
                                placeholder={`1-${totalPages}`}
                                onChange={(
                                  event,
                                ) =>
                                  setJumpPage(
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                onKeyDown={(
                                  event,
                                ) => {
                                  if (
                                    event.key ===
                                    "Enter"
                                  ) {
                                    event.preventDefault();
                                    goToPage();
                                  }
                                }}
                              />

                              <button
                                type="button"
                                className="td-page-jump-go"
                                onClick={
                                  goToPage
                                }
                              >
                                Go
                              </button>
                            </div>
                          </Dropdown.Menu>
                        </Dropdown>
                      );
                    },
                  )}
                </div>

                <button
                  type="button"
                  className="td-page-btn td-page-btn--text"
                  disabled={
                    safePage ===
                    totalPages
                  }
                  onClick={() =>
                    setPage(
                      (previous) =>
                        Math.min(
                          totalPages,
                          previous + 1,
                        ),
                    )
                  }
                >
                  Next
                  <i className="bi bi-chevron-right" />
                </button>
              </div>

              <div className="td-pagination__info">
                Showing{" "}
                {startIndex + 1}-
                {Math.min(
                  startIndex +
                    PAGE_SIZE,
                  docs.length,
                )}{" "}
                of {docs.length}{" "}
                documents
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}