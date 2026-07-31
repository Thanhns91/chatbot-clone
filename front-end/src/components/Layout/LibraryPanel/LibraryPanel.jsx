import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import Button from "react-bootstrap/Button";
import { toast } from "react-toastify";

import {
  getLibraryDocuments,
  publishDocument,
} from "../../../services/api";

import "./LibraryPanel.scss";

const getFileIcon = (fileName = "") => {
  const lowerName = String(
    fileName || "",
  ).toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    return "bi bi-file-earmark-pdf";
  }

  if (
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx")
  ) {
    return "bi bi-file-earmark-word";
  }

  return "bi bi-file-earmark-text";
};

const formatDate = (date) => {
  if (!date) return "";

  try {
    return new Date(
      date,
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
};

const getDocumentUrl = (document) => {
  return (
    document?.fileUrl ||
    document?.file_url ||
    document?.url ||
    document?.downloadUrl ||
    document?.download_url ||
    document?.secure_url ||
    ""
  );
};

const getSubjectLabel = (document) => {
  if (
    document.subjectCode &&
    document.subjectName
  ) {
    return `${document.subjectCode} - ${document.subjectName}`;
  }

  return (
    document.subjectName ||
    document.subjectCode ||
    "No Subject"
  );
};

const getTopicLabel = (document) => {
  return (
    document.topicName ||
    "Uncategorized"
  );
};

const normalizeUser = (user) => {
  if (!user) return null;

  return {
    ...user,
    userId:
      user.userId ||
      user.id ||
      null,

    role:
      String(user.role || "")
        .trim()
        .toLowerCase(),
  };
};

const getStoredUser = () => {
  try {
    const rawUser =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user") ||
      localStorage.getItem(
        "currentUser",
      ) ||
      sessionStorage.getItem(
        "currentUser",
      );

    if (!rawUser) return null;

    return normalizeUser(
      JSON.parse(rawUser),
    );
  } catch {
    return null;
  }
};

const normalizeReviewStatus = (
  document,
) => {
  return String(
    document?.reviewStatus ||
      document?.visibilityStatus ||
      "private",
  )
    .trim()
    .toLowerCase();
};

const isPrivateStudentFile = (
  document,
) => {
  return (
    String(
      document?.uploadedBy || "",
    ).toLowerCase() === "student" &&
    normalizeReviewStatus(
      document,
    ) === "private"
  );
};

const isApprovedStudentFile = (
  document,
) => {
  const status =
    normalizeReviewStatus(document);

  return (
    String(
      document?.uploadedBy || "",
    ).toLowerCase() === "student" &&
    ["approved", "public"].includes(
      status,
    )
  );
};

const normalizeDocuments = (
  result,
) => {
  const documents = Array.isArray(result)
    ? result
    : Array.isArray(result?.data)
      ? result.data
      : [];

  return documents.filter(
    (document, index, array) =>
      index ===
      array.findIndex(
        (item) =>
          String(item.documentId) ===
          String(document.documentId),
      ),
  );
};

const groupByMetadata = (files) => {
  const subjectMap = new Map();

  files.forEach((document) => {
    const subjectKey = `${
      document.subjectId || "none"
    }-${getSubjectLabel(document)}`;

    const topicKey = `${
      document.topicId || "none"
    }-${getTopicLabel(document)}`;

    if (
      !subjectMap.has(subjectKey)
    ) {
      subjectMap.set(subjectKey, {
        label:
          getSubjectLabel(document),

        topics: new Map(),
      });
    }

    const subjectGroup =
      subjectMap.get(subjectKey);

    if (
      !subjectGroup.topics.has(
        topicKey,
      )
    ) {
      subjectGroup.topics.set(
        topicKey,
        {
          label:
            getTopicLabel(document),

          files: [],
        },
      );
    }

    subjectGroup.topics
      .get(topicKey)
      .files.push(document);
  });

  return Array.from(
    subjectMap.values(),
  ).map((subject) => ({
    ...subject,

    topics: Array.from(
      subject.topics.values(),
    ),
  }));
};

const LibraryPanel = ({
  open,
  onClose,
  documents = [],
  selectedDocument,
  onSelectDocument,
  user: propUser,
  onDocumentsChanged,
}) => {
  const [activeTab, setActiveTab] =
    useState("teacher");

  const [
    publishingId,
    setPublishingId,
  ] = useState(null);

  const [
    statusOverrides,
    setStatusOverrides,
  ] = useState({});

  const [libraryDocs, setLibraryDocs] =
    useState(() =>
      normalizeDocuments(documents),
    );

  const [
    loadingLibrary,
    setLoadingLibrary,
  ] = useState(false);

  const currentUser =
    normalizeUser(propUser) ||
    getStoredUser();

  const currentUserRole =
    currentUser?.role || "";

  const currentUserId =
    currentUser?.userId || null;

  /*
   * Khi MemberPage tải lại Library,
   * đồng bộ dữ liệu mới vào panel.
   */
  useEffect(() => {
    setLibraryDocs(
      normalizeDocuments(documents),
    );
  }, [documents]);

  /*
   * Mỗi lần mở Library, tải lại dữ liệu
   * trực tiếp từ API để tránh state cũ.
   */
  useEffect(() => {
    const loadLibraryDocuments =
      async () => {
        if (
          !open ||
          !currentUserId ||
          !currentUserRole
        ) {
          return;
        }

        try {
          setLoadingLibrary(true);

          const result =
            await getLibraryDocuments(
              currentUserId,
              currentUserRole,
            );

          const nextDocuments =
            normalizeDocuments(result);

          setLibraryDocs(
            nextDocuments,
          );
        } catch (error) {
          console.log(
            "Cannot refresh library documents:",
            error,
          );
        } finally {
          setLoadingLibrary(false);
        }
      };

    loadLibraryDocuments();
  }, [
    open,
    currentUserId,
    currentUserRole,
  ]);

  const visibleDocuments =
    useMemo(
      () =>
        libraryDocs.map(
          (document) => ({
            ...document,

            reviewStatus:
              statusOverrides[
                document.documentId
              ] ||
              document.reviewStatus,
          }),
        ),
      [
        libraryDocs,
        statusOverrides,
      ],
    );

  const teacherFiles =
    useMemo(
      () =>
        visibleDocuments.filter(
          (document) =>
            String(
              document.uploadedBy ||
                "",
            ).toLowerCase() ===
            "teacher",
        ),
      [visibleDocuments],
    );

  const studentFiles =
    useMemo(
      () =>
        visibleDocuments.filter(
          (document) => {
            if (
              String(
                document.uploadedBy ||
                  "",
              ).toLowerCase() !==
              "student"
            ) {
              return false;
            }

            /*
             * Student được nhìn thấy toàn bộ
             * file do chính mình upload,
             * kể cả file đang Private.
             */
            if (
              currentUserRole ===
              "student"
            ) {
              return (
                String(
                  document.uploaderId,
                ) ===
                String(currentUserId)
              );
            }

            /*
             * Teacher/Admin chỉ nhìn thấy
             * file Student đã Public.
             */
            return [
              "approved",
              "public",
            ].includes(
              normalizeReviewStatus(
                document,
              ),
            );
          },
        ),
      [
        visibleDocuments,
        currentUserRole,
        currentUserId,
      ],
    );

  const currentFiles =
    activeTab === "teacher"
      ? teacherFiles
      : studentFiles;

  const groupedFiles = useMemo(
    () =>
      groupByMetadata(
        currentFiles,
      ),
    [currentFiles],
  );

  const handleOpenFile = (
    document,
  ) => {
    const rawUrl =
      getDocumentUrl(document);

    if (!rawUrl) return;

    window.open(
      rawUrl,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handlePublishDocument =
    async (document) => {
      if (!currentUserId) {
        toast.warning(
          "Bạn cần đăng nhập để public file.",
        );

        return;
      }

      const confirmed =
        window.confirm(
          `Public file "${document.fileName}"?\nTeacher và Admin sẽ xem được file này.`,
        );

      if (!confirmed) return;

      try {
        setPublishingId(
          document.documentId,
        );

        const result =
          await publishDocument(
            document.documentId,
            currentUserId,
          );

        if (
          result?.success === false
        ) {
          throw new Error(
            result.message ||
              "Public file thất bại",
          );
        }

        setStatusOverrides(
          (previous) => ({
            ...previous,

            [document.documentId]:
              "approved",
          }),
        );

        setLibraryDocs(
          (previousDocuments) =>
            previousDocuments.map(
              (item) =>
                String(
                  item.documentId,
                ) ===
                String(
                  document.documentId,
                )
                  ? {
                      ...item,

                      reviewStatus:
                        "approved",

                      visibilityStatus:
                        "public",
                    }
                  : item,
            ),
        );

        /*
         * Yêu cầu MemberPage tải lại
         * danh sách tài liệu chung.
         */
        await onDocumentsChanged?.();

        toast.success(
          "File đã được public. Teacher và Admin có thể xem file này.",
        );
      } catch (error) {
        toast.error(
          error.message ||
            "Public file thất bại",
        );
      } finally {
        setPublishingId(null);
      }
    };

  const renderEmpty = () => (
    <div className="library-empty">
      <div className="library-empty__icon">
        <i className="bi bi-folder" />
      </div>

      <h4>
        {activeTab === "teacher"
          ? "No teacher materials yet."
          : "No personal uploads yet."}
      </h4>

      <p>
        {activeTab === "teacher"
          ? "Teacher uploaded documents will appear here."
          : "Upload a file in chat and your documents will appear here."}
      </p>
    </div>
  );

  const renderFileCard = (
    document,
  ) => {
    const isActive =
      String(
        selectedDocument?.documentId,
      ) ===
      String(document.documentId);

    const isOwner =
      Boolean(currentUserId) &&
      String(document.uploaderId) ===
        String(currentUserId);

    const canPublish =
      activeTab === "student" &&
      isOwner &&
      isPrivateStudentFile(
        document,
      );

    const versionNumber =
      Number(document.versionNo) ||
      1;

    return (
      <div
        key={`${document.uploadedBy}-${document.documentId}`}
        className={`lesson-card ${
          isActive
            ? "lesson-card--active"
            : ""
        }`}
      >
        <div className="lesson-card__top">
          <div
            className={`lesson-card__icon ${
              document.uploadedBy ===
              "teacher"
                ? "lesson-card__icon--teacher"
                : "lesson-card__icon--student"
            }`}
          >
            <i
              className={getFileIcon(
                document.fileName,
              )}
            />
          </div>

          <div className="lesson-card__info">
            <div
              className="lesson-card__title"
              title={
                document.fileName
              }
            >
              {document.fileName}
            </div>

            <div className="lesson-card__category">
              {document.uploadedBy ===
              "teacher"
                ? `Teacher: ${
                    document.uploaderName ||
                    "Unknown"
                  }`
                : "My Upload"}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 6,
              }}
            >
              <span
                style={{
                  display:
                    "inline-flex",

                  alignItems:
                    "center",

                  gap: 4,

                  padding:
                    "3px 8px",

                  borderRadius: 999,

                  background:
                    "#eef2ff",

                  color:
                    "#4338ca",

                  fontSize: 11,

                  fontWeight: 700,
                }}
                title={`Document version ${versionNumber}`}
              >
                <i className="bi bi-layers" />
                Version {versionNumber}
              </span>

              {document.uploadedBy ===
                "student" && (
                <div
                  className={`lesson-card__status ${
                    isPrivateStudentFile(
                      document,
                    )
                      ? "lesson-card__status--private"
                      : isApprovedStudentFile(
                            document,
                          )
                        ? "lesson-card__status--public"
                        : "lesson-card__status--pending"
                  }`}
                >
                  <i
                    className={
                      isPrivateStudentFile(
                        document,
                      )
                        ? "bi bi-lock-fill"
                        : isApprovedStudentFile(
                              document,
                            )
                          ? "bi bi-globe2"
                          : "bi bi-hourglass-split"
                    }
                  />

                  {isPrivateStudentFile(
                    document,
                  )
                    ? "Private"
                    : isApprovedStudentFile(
                          document,
                        )
                      ? "Public"
                      : document.reviewStatus ||
                        "Pending"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lesson-card__meta">
          {document.documentTypeName ||
            document.fileType ||
            "Document"}

          {document.levelName
            ? ` · ${document.levelName}`
            : ""}

          {" · "}

          {formatDate(
            document.uploadDate,
          )}
        </div>

        <div className="lesson-card__actions">
          <Button
            variant="outline-secondary"
            className="lesson-card__btn-open"
            onClick={() =>
              handleOpenFile(document)
            }
            disabled={
              !getDocumentUrl(
                document,
              )
            }
          >
            <i className="bi bi-box-arrow-up-right me-1" />
            Open
          </Button>

          <Button
            variant="primary"
            className="lesson-card__btn-ask"
            onClick={() =>
              onSelectDocument?.(
                document,
              )
            }
          >
            <i className="bi bi-chat-dots me-1" />

            {isActive
              ? "Using"
              : "Ask AI"}
          </Button>

          {canPublish && (
            <Button
              variant="success"
              className="lesson-card__btn-public"
              onClick={() =>
                handlePublishDocument(
                  document,
                )
              }
              disabled={
                publishingId ===
                document.documentId
              }
            >
              <i className="bi bi-globe2 me-1" />

              {publishingId ===
              document.documentId
                ? "..."
                : "Public"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`library-panel ${
        open
          ? "library-panel--open"
          : ""
      }`}
    >
      <div className="library-panel__inner">
        <div className="library-panel__header">
          <div className="library-panel__title">
            <i className="bi bi-book" />
            Library
          </div>

          <Button
            variant="light"
            className="library-panel__close"
            onClick={onClose}
            title="Close"
          >
            <i className="bi bi-x-lg" />
          </Button>
        </div>

        <div className="library-panel__tabs">
          <button
            type="button"
            className={`library-panel__tab ${
              activeTab === "teacher"
                ? "library-panel__tab--active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("teacher")
            }
          >
            <i className="bi bi-mortarboard" />
            Teacher

            <span>
              {teacherFiles.length}
            </span>
          </button>

          <button
            type="button"
            className={`library-panel__tab ${
              activeTab === "student"
                ? "library-panel__tab--active"
                : ""
            }`}
            onClick={() =>
              setActiveTab("student")
            }
          >
            <i className="bi bi-person" />
            My Files

            <span>
              {studentFiles.length}
            </span>
          </button>
        </div>

        <div className="library-panel__count">
          {loadingLibrary
            ? "LOADING..."
            : `${currentFiles.length} DOCUMENTS AVAILABLE`}
        </div>

        <div className="library-panel__list">
          {currentFiles.length === 0
            ? renderEmpty()
            : groupedFiles.map(
                (subject) => (
                  <div
                    key={
                      subject.label
                    }
                    className="library-meta-group"
                  >
                    <div className="library-meta-group__subject">
                      <i className="bi bi-folder2-open" />

                      {subject.label}
                    </div>

                    {subject.topics.map(
                      (topic) => (
                        <div
                          key={`${subject.label}-${topic.label}`}
                        >
                          <div className="library-meta-group__topic">
                            {topic.label}
                          </div>

                          {topic.files.map(
                            renderFileCard,
                          )}
                        </div>
                      ),
                    )}
                  </div>
                ),
              )}
        </div>
      </div>
    </div>
  );
};

export default LibraryPanel;