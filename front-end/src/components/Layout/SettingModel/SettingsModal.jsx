import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { toast } from "react-toastify";

import {
  uploadAvatar,
  getSubscriptionPlans,
  getUserStorage,
  getUpgradePreview,
  cancelSubscription,
  resumeSubscription,
  createVnpayPayment,
  getPaymentHistory,
  getPaymentStatus,
} from "../../../services/api";

import "./SettingsModal.scss";

const STUDENT_THEME_KEY = "studentTheme";

const getInitialStudentTheme = () => {
  const savedTheme =
    localStorage.getItem(STUDENT_THEME_KEY) ||
    localStorage.getItem("theme") ||
    "light";

  const finalTheme =
    savedTheme === "dark" ? "dark" : "light";

  localStorage.setItem(
    STUDENT_THEME_KEY,
    finalTheme,
  );

  /*
   * Xóa key theme cũ vì trước đây Teacher và Admin
   * cũng đang đọc nhầm key này.
   */
  localStorage.removeItem("theme");

  return finalTheme;
};

const applyStudentThemeToDOM = (theme) => {
  const finalTheme =
    theme === "dark" ? "dark" : "light";

  localStorage.setItem(
    STUDENT_THEME_KEY,
    finalTheme,
  );

  document.documentElement.setAttribute(
    "data-theme",
    finalTheme,
  );

  document.documentElement.classList.toggle(
    "dark",
    finalTheme === "dark",
  );

  document.documentElement.classList.toggle(
    "theme-dark",
    finalTheme === "dark",
  );

  document.documentElement.classList.remove(
    "dark-mode",
  );

  document.body.classList.toggle(
    "dark",
    finalTheme === "dark",
  );

  document.body.classList.toggle(
    "theme-dark",
    finalTheme === "dark",
  );

  document.body.classList.remove(
    "dark-mode",
  );

  window.dispatchEvent(
    new CustomEvent("studentThemeChanged", {
      detail: finalTheme,
    }),
  );
};

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(
      value /
      1024 /
      1024
    ).toFixed(1)} MB`;
  }

  return `${(
    value /
    1024 /
    1024 /
    1024
  ).toFixed(2)} GB`;
};

const formatMoney = (amount = 0) =>
  `${Number(amount || 0).toLocaleString(
    "vi-VN",
  )} ₫`;

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("vi-VN");
};

const paymentStatusLabel = (status) => {
  const map = {
    pending: "Đang chờ",
    paid: "Đã thanh toán",
    failed: "Thất bại",
    cancelled: "Đã hủy",
  };

  return map[status] || status || "-";
};

export default function SettingsModal({
  user,
  onClose,
  onSave,
  initialTab,
  planOnly = false,
}) {
  const fileInputRef = useRef(null);

  const isStudent =
    String(user?.role || "").toLowerCase() ===
    "student";

  const [activeTab, setActiveTab] =
    useState(() => {
      if (planOnly) {
        return "plan";
      }

      if (initialTab === "appearance") {
        return isStudent
          ? "appearance"
          : "profile";
      }

      if (initialTab) {
        return initialTab;
      }

      return user ? "profile" : "profile";
    });

  const [theme, setTheme] = useState(() =>
    isStudent
      ? getInitialStudentTheme()
      : "light",
  );

  const [chatLanguage, setChatLanguage] =
    useState(
      localStorage.getItem(
        "chatLanguage",
      ) || "vi",
    );

  const [form, setForm] = useState({
    name:
      user?.name ||
      user?.fullName ||
      "",

    email: user?.email || "",
    bio: user?.bio || "",
  });

  const [avatarFile, setAvatarFile] =
    useState(null);

  const [avatarPreview, setAvatarPreview] =
    useState(
      user?.avatar_url ||
        user?.avatarUrl ||
        "",
    );

  const [saving, setSaving] =
    useState(false);

  const [plans, setPlans] =
    useState([]);

  const [storage, setStorage] =
    useState(null);

  const [payments, setPayments] =
    useState([]);

  const [planLoading, setPlanLoading] =
    useState(false);

  const [planError, setPlanError] =
    useState("");

  const [selectedPlan, setSelectedPlan] =
    useState(null);

  const [
    upgradePreview,
    setUpgradePreview,
  ] = useState(null);

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);

  const [
    paymentLoading,
    setPaymentLoading,
  ] = useState(false);

  const [
    subscriptionActionLoading,
    setSubscriptionActionLoading,
  ] = useState(false);

  const [
    paymentNotice,
    setPaymentNotice,
  ] = useState("");

  const [returnTxnRef, setReturnTxnRef] =
    useState("");

  const [
    planReloadToken,
    setPlanReloadToken,
  ] = useState(0);

  const [
    renewalDismissed,
    setRenewalDismissed,
  ] = useState(false);

  /*
   * Chỉ Student mới được thay đổi Dark Mode.
   */
  useEffect(() => {
    if (!isStudent) {
      return;
    }

    applyStudentThemeToDOM(theme);
  }, [theme, isStudent]);

  useEffect(() => {
    localStorage.setItem(
      "chatLanguage",
      chatLanguage,
    );

    window.dispatchEvent(
      new CustomEvent(
        "chatLanguageChanged",
        {
          detail: chatLanguage,
        },
      ),
    );
  }, [chatLanguage]);

  useEffect(() => {
    return () => {
      if (
        avatarPreview?.startsWith(
          "blob:",
        )
      ) {
        URL.revokeObjectURL(
          avatarPreview,
        );
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (!isStudent) return;

    if (
      !planOnly &&
      initialTab !== "plan"
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search,
      );

    const payment =
      params.get("payment");

    const txnRef =
      params.get("txnRef") || "";

    if (!payment) return;

    setActiveTab("plan");
    setReturnTxnRef(txnRef);

    if (payment === "success") {
      setPaymentNotice(
        "Thanh toán VNPAY thành công. Gói của bạn đã được cập nhật.",
      );
    } else if (
      payment === "pending"
    ) {
      setPaymentNotice(
        "VNPAY đã trả kết quả thành công. Hệ thống đang chờ IPN xác nhận giao dịch...",
      );
    } else if (
      payment === "failed"
    ) {
      setPaymentNotice(
        "Giao dịch VNPAY không thành công hoặc đã bị hủy.",
      );
    } else if (
      payment === "invalid"
    ) {
      setPaymentNotice(
        "Không thể xác thực dữ liệu trả về từ VNPAY.",
      );
    } else {
      setPaymentNotice(
        "Không thể xác định kết quả giao dịch VNPAY.",
      );
    }
  }, [
    isStudent,
    planOnly,
    initialTab,
  ]);

  useEffect(() => {
    if (
      activeTab !== "plan" ||
      !isStudent ||
      !user?.userId
    ) {
      return undefined;
    }

    let cancelled = false;

    const loadPlanData = async () => {
      try {
        setPlanLoading(true);
        setPlanError("");

        const [
          plansResult,
          storageResult,
          paymentsResult,
        ] = await Promise.all([
          getSubscriptionPlans(),

          getUserStorage(
            user.userId,
          ),

          getPaymentHistory(
            user.userId,
          ),
        ]);

        if (cancelled) return;

        setPlans(
          plansResult.data || [],
        );

        setStorage(
          storageResult.data || null,
        );

        setPayments(
          paymentsResult.data || [],
        );
      } catch (error) {
        if (!cancelled) {
          console.error(error);

          setPlanError(
            error.message ||
              "Không thể tải thông tin gói và dung lượng.",
          );
        }
      } finally {
        if (!cancelled) {
          setPlanLoading(false);
        }
      }
    };

    loadPlanData();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    isStudent,
    user?.userId,
    planReloadToken,
  ]);

  useEffect(() => {
    if (
      !returnTxnRef ||
      !isStudent
    ) {
      return undefined;
    }

    let cancelled = false;
    let timerId;

    const clearPaymentQuery = () => {
      const url = new URL(
        window.location.href,
      );

      url.searchParams.delete(
        "payment",
      );

      url.searchParams.delete(
        "txnRef",
      );

      url.searchParams.delete(
        "vnp_ResponseCode",
      );

      window.history.replaceState(
        {},
        "",
        url.toString(),
      );
    };

    const pollPayment = async () => {
      for (
        let attempt = 0;
        attempt < 10 && !cancelled;
        attempt += 1
      ) {
        try {
          const result =
            await getPaymentStatus(
              returnTxnRef,
            );

          const payment = result.data;

          if (
            payment?.status === "paid"
          ) {
            setPaymentNotice(
              "Thanh toán VNPAY thành công. Gói đã được kích hoạt.",
            );

            setReturnTxnRef("");

            setPlanReloadToken(
              (value) => value + 1,
            );

            clearPaymentQuery();

            return;
          }

          if (
            payment?.status === "failed"
          ) {
            setPaymentNotice(
              "Giao dịch VNPAY thất bại.",
            );

            setReturnTxnRef("");

            setPlanReloadToken(
              (value) => value + 1,
            );

            clearPaymentQuery();

            return;
          }

          if (
            payment?.status ===
            "cancelled"
          ) {
            setPaymentNotice(
              "Yêu cầu thanh toán này đã bị hủy.",
            );

            setReturnTxnRef("");

            setPlanReloadToken(
              (value) => value + 1,
            );

            clearPaymentQuery();

            return;
          }
        } catch (error) {
          console.error(
            "Check VNPAY payment status failed:",
            error,
          );
        }

        await new Promise(
          (resolve) => {
            timerId =
              window.setTimeout(
                resolve,
                1500,
              );
          },
        );
      }

      if (!cancelled) {
        setPaymentNotice(
          "Giao dịch vẫn đang chờ VNPAY IPN. Bạn có thể đóng Settings và kiểm tra lại sau.",
        );
      }
    };

    pollPayment();

    return () => {
      cancelled = true;

      if (timerId) {
        window.clearTimeout(
          timerId,
        );
      }
    };
  }, [returnTxnRef, isStudent]);

  const handleThemeChange = (
    nextTheme,
  ) => {
    if (!isStudent) {
      return;
    }

    setTheme(
      nextTheme === "dark"
        ? "dark"
        : "light",
    );
  };

  const getInitial = () => {
    return (
      form.name
        ?.charAt(0)
        ?.toUpperCase() ||
      user?.email
        ?.charAt(0)
        ?.toUpperCase() ||
      "U"
    );
  };

  const saveUserToStorage = (
    updatedUser,
  ) => {
    const finalUser = {
      ...updatedUser,

      name:
        updatedUser.name ||
        updatedUser.fullName ||
        form.name,

      fullName:
        updatedUser.fullName ||
        updatedUser.name ||
        form.name,

      email:
        updatedUser.email ||
        form.email,

      bio:
        updatedUser.bio ||
        form.bio,

      avatar_url:
        updatedUser.avatar_url ||
        updatedUser.avatarUrl ||
        "",

      avatarUrl:
        updatedUser.avatarUrl ||
        updatedUser.avatar_url ||
        "",
    };

    if (
      localStorage.getItem(
        "currentUser",
      )
    ) {
      localStorage.setItem(
        "currentUser",
        JSON.stringify(finalUser),
      );
    }

    if (
      sessionStorage.getItem(
        "currentUser",
      )
    ) {
      sessionStorage.setItem(
        "currentUser",
        JSON.stringify(finalUser),
      );
    }

    return finalUser;
  };

  const handleChooseAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (
    event,
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith(
        "image/",
      )
    ) {
      toast.warning(
        "Vui lòng chọn một file hình ảnh.",
      );

      event.target.value = "";

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      toast.warning(
        "Kích thước ảnh phải nhỏ hơn 5MB.",
      );

      event.target.value = "";

      return;
    }

    if (
      avatarPreview?.startsWith(
        "blob:",
      )
    ) {
      URL.revokeObjectURL(
        avatarPreview,
      );
    }

    setAvatarFile(file);

    setAvatarPreview(
      URL.createObjectURL(file),
    );
  };

  const handleSave = async () => {
    if (!user?.userId) {
      toast.error("Không tìm thấy thông tin người dùng.");
      return;
    }

    if (!form.name.trim()) {
      toast.warning(
        "Vui lòng nhập tên hiển thị.",
      );

      return;
    }

    if (!form.email.trim()) {
      toast.warning("Vui lòng nhập Email.");
      return;
    }

    try {
      setSaving(true);

      let updatedUser = {
        ...user,

        name: form.name.trim(),

        fullName:
          form.name.trim(),

        email:
          form.email.trim(),

        bio: form.bio,
      };

      if (avatarFile) {
        const avatarResult =
          await uploadAvatar(
            user.userId,
            avatarFile,
          );

        if (
          !avatarResult.success
        ) {
          throw new Error(
            avatarResult.detail ||
              avatarResult.message ||
              "Upload avatar failed.",
          );
        }

        updatedUser = {
          ...updatedUser,
          ...avatarResult.user,

          avatar_url:
            avatarResult.avatar_url ||
            avatarResult.user
              ?.avatar_url,

          avatarUrl:
            avatarResult.avatarUrl ||
            avatarResult.user
              ?.avatarUrl,
        };
      }

      const finalUser =
        saveUserToStorage(
          updatedUser,
        );

      onSave?.(finalUser);
      toast.success("Cập nhật thông tin tài khoản thành công!");
      onClose?.();
    } catch (error) {
      toast.error(
        error.message ||
          "Lưu thay đổi thất bại.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveVnpayReturnPath = () => {
    const returnPath =
      `${window.location.pathname}${
        window.location.hash || ""
      }`;

    sessionStorage.setItem(
      "vnpayReturnPath",
      returnPath,
    );
  };

  const handlePreviewUpgrade =
    async (plan) => {
      if (
        !user?.userId ||
        !plan?.planId
      ) {
        return;
      }

      try {
        setPreviewLoading(true);
        setPlanError("");
        setPaymentNotice("");
        setSelectedPlan(plan);
        setUpgradePreview(null);

        const result =
          await getUpgradePreview(
            user.userId,
            plan.planId,
          );

        setUpgradePreview(
          result.data || null,
        );
      } catch (error) {
        console.error(error);

        setPlanError(
          error.message ||
            "Không thể tính giá nâng cấp.",
        );
      } finally {
        setPreviewLoading(false);
      }
    };

  const handlePayWithVnpay =
    async () => {
      if (
        !user?.userId ||
        !selectedPlan?.planId ||
        !upgradePreview
      ) {
        return;
      }

      try {
        setPaymentLoading(true);
        setPlanError("");

        setPaymentNotice(
          "Đang tạo giao dịch VNPAY Sandbox...",
        );

        const result =
          await createVnpayPayment(
            user.userId,
            selectedPlan.planId,
            {
              locale:
                chatLanguage === "en"
                  ? "en"
                  : "vn",
            },
          );

        const paymentUrl =
          result.data?.paymentUrl;

        if (!paymentUrl) {
          throw new Error(
            "Backend không trả về VNPAY payment URL.",
          );
        }

        saveVnpayReturnPath();

        window.location.assign(
          paymentUrl,
        );
      } catch (error) {
        console.error(error);

        setPlanError(
          error.message ||
            "Không thể tạo giao dịch VNPAY.",
        );

        setPaymentNotice("");
        setPaymentLoading(false);
      }
    };

  const handleCancelSubscription =
    async () => {
      if (
        !user?.userId ||
        !storage?.subscription
      ) {
        return;
      }

      const endDate =
        storage.subscription.endDate
          ? new Date(
              storage.subscription.endDate,
            ).toLocaleDateString(
              "vi-VN",
            )
          : "ngày hết hạn";

      const confirmed =
        window.confirm(
          `Bạn muốn hủy gói ${
            storage.plan?.planName ||
            "hiện tại"
          }?\n\n` +
            `Bạn vẫn được sử dụng gói đến ${endDate}. Khi hết hạn, hệ thống sẽ hỏi bạn có muốn gia hạn; nếu không, tài khoản dùng Free 150 MB.`,
        );

      if (!confirmed) return;

      try {
        setSubscriptionActionLoading(
          true,
        );

        setPlanError("");
        setPaymentNotice("");

        const result =
          await cancelSubscription(
            user.userId,
          );

        setPaymentNotice(
          result.message ||
            "Đã đặt hủy gói. Gói hiện tại vẫn dùng được đến ngày hết hạn.",
        );

        setSelectedPlan(null);
        setUpgradePreview(null);

        setPlanReloadToken(
          (value) => value + 1,
        );
      } catch (error) {
        console.error(error);

        setPlanError(
          error.message ||
            "Không thể hủy gói.",
        );
      } finally {
        setSubscriptionActionLoading(
          false,
        );
      }
    };

  const handleResumeSubscription =
    async () => {
      if (
        !user?.userId ||
        !storage?.subscription
      ) {
        return;
      }

      try {
        setSubscriptionActionLoading(
          true,
        );

        setPlanError("");
        setPaymentNotice("");

        const result =
          await resumeSubscription(
            user.userId,
          );

        setPaymentNotice(
          result.message ||
            "Đã tiếp tục gói hiện tại.",
        );

        setPlanReloadToken(
          (value) => value + 1,
        );
      } catch (error) {
        console.error(error);

        setPlanError(
          error.message ||
            "Không thể tiếp tục gói.",
        );
      } finally {
        setSubscriptionActionLoading(
          false,
        );
      }
    };

  const handleRenewExpiredPlan =
    async () => {
      const offer =
        storage?.renewalOffer;

      if (
        !user?.userId ||
        !offer?.planId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Gói ${offer.planName} đã hết hạn.\n\n` +
            `Gia hạn thêm ${
              offer.durationDays ||
              30
            } ngày với ${formatMoney(
              offer.price,
            )}?`,
        );

      if (!confirmed) return;

      try {
        setPaymentLoading(true);
        setPlanError("");

        setPaymentNotice(
          "Đang tạo giao dịch gia hạn VNPAY Sandbox...",
        );

        const result =
          await createVnpayPayment(
            user.userId,
            offer.planId,
            {
              locale:
                chatLanguage === "en"
                  ? "en"
                  : "vn",
            },
          );

        const paymentUrl =
          result.data?.paymentUrl;

        if (!paymentUrl) {
          throw new Error(
            "Backend không trả về VNPAY payment URL.",
          );
        }

        saveVnpayReturnPath();

        window.location.assign(
          paymentUrl,
        );
      } catch (error) {
        console.error(error);

        setPlanError(
          error.message ||
            "Không thể tạo giao dịch gia hạn VNPAY.",
        );

        setPaymentNotice("");
        setPaymentLoading(false);
      }
    };

  return (
    <div
      className="sm-overlay"
      onClick={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.();
        }
      }}
    >
      <div className="sm-card">
        <div className="sm-header">
          <h2 className="sm-title">
            {planOnly
              ? "Gói & dung lượng"
              : "Settings"}
          </h2>

          <Button
            variant="light"
            className="sm-close"
            onClick={onClose}
          >
            <i className="bi bi-x-lg" />
          </Button>
        </div>

        {!planOnly && (
          <div className="sm-tabs">
            {user && (
              <button
                type="button"
                className={`sm-tab ${
                  activeTab === "profile"
                    ? "sm-tab--active"
                    : ""
                }`}
                onClick={() =>
                  setActiveTab("profile")
                }
              >
                <i className="bi bi-person" />
                Profile
              </button>
            )}

            {isStudent && (
              <button
                type="button"
                className={`sm-tab ${
                  activeTab ===
                  "appearance"
                    ? "sm-tab--active"
                    : ""
                }`}
                onClick={() =>
                  setActiveTab(
                    "appearance",
                  )
                }
              >
                <i className="bi bi-brightness-high" />
                Appearance
              </button>
            )}
          </div>
        )}

        <div className="sm-body">
          {activeTab ===
            "appearance" &&
            isStudent && (
              <div className="sm-appearance">
                <p className="sm-desc">
                  Choose your preferred
                  interface theme.
                </p>

                <div className="sm-theme-grid">
                  <button
                    type="button"
                    className={`sm-theme-card ${
                      theme === "light"
                        ? "sm-theme-card--active"
                        : ""
                    }`}
                    onClick={() =>
                      handleThemeChange(
                        "light",
                      )
                    }
                  >
                    <div className="sm-theme-preview sm-theme-preview--light">
                      <i className="bi bi-sun" />
                    </div>

                    <div className="sm-theme-info">
                      <span className="sm-theme-name">
                        Light
                      </span>

                      <span className="sm-theme-desc">
                        Default theme
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`sm-theme-card ${
                      theme === "dark"
                        ? "sm-theme-card--active"
                        : ""
                    }`}
                    onClick={() =>
                      handleThemeChange(
                        "dark",
                      )
                    }
                  >
                    <div className="sm-theme-preview sm-theme-preview--dark">
                      <i className="bi bi-moon" />
                    </div>

                    <div className="sm-theme-info">
                      <span className="sm-theme-name">
                        Dark
                      </span>

                      <span className="sm-theme-desc">
                        Easy on the eyes
                      </span>
                    </div>
                  </button>
                </div>

                <div className="sm-language-section">
                  <p className="sm-desc">
                    Choose chatbot
                    response language.
                  </p>

                  <div className="sm-language-grid">
                    <button
                      type="button"
                      className={`sm-language-card ${
                        chatLanguage ===
                        "vi"
                          ? "sm-language-card--active"
                          : ""
                      }`}
                      onClick={() =>
                        setChatLanguage(
                          "vi",
                        )
                      }
                    >
                      <i className="bi bi-translate" />

                      <div>
                        <strong>
                          Vietnamese
                        </strong>

                        <span>
                          Chatbot trả lời
                          bằng tiếng Việt
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`sm-language-card ${
                        chatLanguage ===
                        "en"
                          ? "sm-language-card--active"
                          : ""
                      }`}
                      onClick={() =>
                        setChatLanguage(
                          "en",
                        )
                      }
                    >
                      <i className="bi bi-translate" />

                      <div>
                        <strong>
                          English
                        </strong>

                        <span>
                          Chatbot answers
                          in English
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

          {activeTab === "plan" &&
            isStudent && (
              <div className="sm-plan">
                {planLoading ? (
                  <div className="sm-plan-loading">
                    Đang tải thông tin
                    gói...
                  </div>
                ) : (
                  <>
                    {planError && (
                      <div className="sm-plan-error">
                        {planError}
                      </div>
                    )}

                    {paymentNotice && (
                      <div className="sm-payment-notice">
                        {paymentNotice}
                      </div>
                    )}

                    {storage && (
                      <div className="sm-storage-card">
                        <div className="sm-storage-head">
                          <div>
                            <span className="sm-storage-label">
                              Gói hiện tại
                            </span>

                            <strong className="sm-storage-plan">
                              {storage.plan
                                ?.planName ||
                                "Free"}
                            </strong>
                          </div>

                          <span className="sm-storage-percent">
                            {storage.percentage ||
                              0}
                            %
                          </span>
                        </div>

                        <div className="sm-storage-progress">
                          <div
                            className="sm-storage-progress__bar"
                            style={{
                              width: `${Math.min(
                                Number(
                                  storage.percentage ||
                                    0,
                                ),
                                100,
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="sm-storage-meta">
                          <span>
                            {formatBytes(
                              storage.usedBytes,
                            )}{" "}
                            đã dùng
                          </span>

                          <span>
                            {formatBytes(
                              storage.limitBytes,
                            )}{" "}
                            tổng
                          </span>
                        </div>

                        <div className="sm-storage-docs">
                          {storage.documentCount ||
                            0}{" "}
                          tài liệu
                        </div>

                        {storage.subscription && (
                          <div className="sm-subscription-info">
                            <div className="sm-subscription-info__row">
                              <span>
                                Thời gian còn
                                lại
                              </span>

                              <strong>
                                {storage
                                  .subscription
                                  .remainingDays ||
                                  0}{" "}
                                ngày
                              </strong>
                            </div>

                            <div className="sm-subscription-info__row">
                              <span>
                                Ngày hết hạn
                              </span>

                              <strong>
                                {new Date(
                                  storage
                                    .subscription
                                    .endDate,
                                ).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </strong>
                            </div>

                            {storage
                              .subscription
                              .cancelAtPeriodEnd ? (
                              <div className="sm-cancel-scheduled">
                                <div>
                                  <strong>
                                    Đã đặt hủy
                                    gói
                                  </strong>

                                  <span>
                                    Bạn vẫn dùng{" "}
                                    {
                                      storage.plan
                                        ?.planName
                                    }{" "}
                                    đến ngày hết
                                    hạn.
                                  </span>
                                </div>

                                <Button
                                  type="button"
                                  className="sm-resume-button"
                                  disabled={
                                    subscriptionActionLoading
                                  }
                                  onClick={
                                    handleResumeSubscription
                                  }
                                >
                                  {subscriptionActionLoading
                                    ? "Đang xử lý..."
                                    : "Tiếp tục gói"}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                className="sm-cancel-button"
                                disabled={
                                  subscriptionActionLoading
                                }
                                onClick={
                                  handleCancelSubscription
                                }
                              >
                                {subscriptionActionLoading
                                  ? "Đang xử lý..."
                                  : "Hủy gói khi hết chu kỳ"}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {storage?.renewalOffer &&
                      !renewalDismissed && (
                        <div className="sm-renewal-card">
                          <div className="sm-renewal-card__icon">
                            <i className="bi bi-arrow-clockwise" />
                          </div>

                          <div className="sm-renewal-card__content">
                            <strong>
                              Gói{" "}
                              {
                                storage
                                  .renewalOffer
                                  .planName
                              }{" "}
                              đã hết hạn
                            </strong>

                            <span>
                              Hết hạn ngày{" "}
                              {new Date(
                                storage
                                  .renewalOffer
                                  .expiredAt,
                              ).toLocaleDateString(
                                "vi-VN",
                              )}
                              . Bạn có muốn
                              gia hạn thêm{" "}
                              {storage
                                .renewalOffer
                                .durationDays ||
                                30}{" "}
                              ngày với{" "}
                              {formatMoney(
                                storage
                                  .renewalOffer
                                  .price,
                              )}{" "}
                              không?
                            </span>

                            <div className="sm-renewal-card__actions">
                              <Button
                                type="button"
                                className="sm-renew-button"
                                disabled={
                                  paymentLoading
                                }
                                onClick={
                                  handleRenewExpiredPlan
                                }
                              >
                                {paymentLoading
                                  ? "Đang chuyển VNPAY..."
                                  : "Gia hạn qua VNPAY"}
                              </Button>

                              <Button
                                type="button"
                                className="sm-renew-decline-button"
                                disabled={
                                  paymentLoading
                                }
                                onClick={() =>
                                  setRenewalDismissed(
                                    true,
                                  )
                                }
                              >
                                Không, tiếp tục
                                Free
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                    <div className="sm-plan-heading">
                      <h3>
                        {Number(
                          storage?.plan
                            ?.price || 0,
                        ) > 0
                          ? "Nâng cấp gói lưu trữ"
                          : "Chọn gói lưu trữ"}
                      </h3>

                      <p>
                        Thanh toán qua
                        VNPAY Sandbox.
                      </p>
                    </div>

                    <div className="sm-plan-grid">
                      {plans.map(
                        (plan) => {
                          const currentPrice =
                            Number(
                              storage
                                ?.plan
                                ?.price ||
                                0,
                            );

                          const planPrice =
                            Number(
                              plan.price ||
                                0,
                            );

                          const isCurrent =
                            String(
                              plan.planName,
                            ).toLowerCase() ===
                            String(
                              storage?.plan
                                ?.planName ||
                                "",
                            ).toLowerCase();

                          const canUpgrade =
                            !isCurrent &&
                            planPrice >
                              currentPrice;

                          return (
                            <div
                              key={
                                plan.planId
                              }
                              className={`sm-plan-card ${
                                selectedPlan
                                  ?.planId ===
                                plan.planId
                                  ? "sm-plan-card--selected"
                                  : ""
                              }`}
                            >
                              <div className="sm-plan-card__top">
                                <div>
                                  <strong>
                                    {
                                      plan.planName
                                    }
                                  </strong>

                                  <span>
                                    {formatBytes(
                                      plan.storageLimitBytes,
                                    )}{" "}
                                    storage
                                  </span>
                                </div>

                                {isCurrent && (
                                  <span className="sm-plan-current">
                                    Current
                                  </span>
                                )}
                              </div>

                              <div className="sm-plan-price">
                                {formatMoney(
                                  plan.price,
                                )}

                                {Number(
                                  plan.price ||
                                    0,
                                ) > 0 && (
                                  <span>
                                    /{" "}
                                    {
                                      plan.durationDays
                                    }{" "}
                                    ngày
                                  </span>
                                )}
                              </div>

                              {plan.description && (
                                <p className="sm-plan-description">
                                  {
                                    plan.description
                                  }
                                </p>
                              )}

                              <Button
                                type="button"
                                className="sm-plan-button"
                                disabled={
                                  !canUpgrade ||
                                  previewLoading ||
                                  paymentLoading
                                }
                                onClick={() =>
                                  handlePreviewUpgrade(
                                    plan,
                                  )
                                }
                              >
                                {isCurrent
                                  ? "Gói hiện tại"
                                  : canUpgrade
                                    ? currentPrice >
                                      0
                                      ? "Nâng gói"
                                      : "Chọn gói"
                                    : "Không khả dụng"}
                              </Button>
                            </div>
                          );
                        },
                      )}
                    </div>

                    {previewLoading && (
                      <div className="sm-plan-preview">
                        Đang tính số tiền
                        cần thanh toán...
                      </div>
                    )}

                    {upgradePreview &&
                      !previewLoading && (
                        <div className="sm-plan-preview">
                          <div className="sm-plan-preview__title">
                            Xác nhận thanh
                            toán
                          </div>

                          <div className="sm-plan-preview__row">
                            <span>
                              Gói hiện tại
                            </span>

                            <strong>
                              {
                                upgradePreview
                                  .currentPlan
                                  ?.planName
                              }
                            </strong>
                          </div>

                          <div className="sm-plan-preview__row">
                            <span>
                              Gói mới
                            </span>

                            <strong>
                              {
                                upgradePreview
                                  .targetPlan
                                  ?.planName
                              }
                            </strong>
                          </div>

                          {upgradePreview.type ===
                            "upgrade" && (
                            <>
                              <div className="sm-plan-preview__row">
                                <span>
                                  Số ngày còn
                                  lại của gói
                                  cũ
                                </span>

                                <strong>
                                  {upgradePreview.remainingDays ||
                                    0}{" "}
                                  /{" "}
                                  {upgradePreview.totalDays ||
                                    0}{" "}
                                  ngày
                                </strong>
                              </div>

                              <div className="sm-plan-preview__row">
                                <span>
                                  Giá gói mới
                                  cho thời gian
                                  còn lại
                                </span>

                                <strong>
                                  {formatMoney(
                                    upgradePreview.originalAmount,
                                  )}
                                </strong>
                              </div>

                              <div className="sm-plan-preview__row">
                                <span>
                                  Credit gói cũ
                                  chưa sử dụng
                                </span>

                                <strong>
                                  -
                                  {formatMoney(
                                    upgradePreview.discountAmount,
                                  )}
                                </strong>
                              </div>
                            </>
                          )}

                          <div className="sm-plan-preview__total">
                            <span>
                              Thanh toán
                            </span>

                            <strong>
                              {formatMoney(
                                upgradePreview.finalAmount,
                              )}
                            </strong>
                          </div>

                          {upgradePreview.endDate && (
                            <div className="sm-plan-preview__note">
                              Sau khi upgrade,
                              ngày hết hạn vẫn
                              giữ:{" "}
                              {new Date(
                                upgradePreview.endDate,
                              ).toLocaleDateString(
                                "vi-VN",
                              )}
                            </div>
                          )}

                          <Button
                            type="button"
                            className="sm-vnpay-button"
                            disabled={
                              paymentLoading
                            }
                            onClick={
                              handlePayWithVnpay
                            }
                          >
                            {paymentLoading
                              ? "Đang chuyển sang VNPAY..."
                              : (
                                <>
                                  <i className="bi bi-credit-card" />
                                  Thanh toán
                                  VNPAY Sandbox
                                </>
                              )}
                          </Button>
                        </div>
                      )}

                    <div className="sm-payment-history">
                      <div className="sm-plan-heading">
                        <h3>
                          Lịch sử thanh toán
                        </h3>
                      </div>

                      {payments.length ===
                      0 ? (
                        <div className="sm-payment-empty">
                          Chưa có giao dịch.
                        </div>
                      ) : (
                        <div className="sm-payment-list">
                          {payments.map(
                            (payment) => (
                              <div
                                className="sm-payment-item"
                                key={
                                  payment.paymentId
                                }
                              >
                                <div>
                                  <strong>
                                    {payment.planName ||
                                      "Subscription"}
                                  </strong>

                                  <span>
                                    {formatDateTime(
                                      payment.createdAt,
                                    )}
                                  </span>

                                  <small>
                                    {
                                      payment.transactionCode
                                    }
                                  </small>
                                </div>

                                <div className="sm-payment-item__right">
                                  <strong>
                                    {formatMoney(
                                      payment.finalAmount,
                                    )}
                                  </strong>

                                  <span
                                    className={`sm-payment-status sm-payment-status--${payment.status}`}
                                  >
                                    {paymentStatusLabel(
                                      payment.status,
                                    )}
                                  </span>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

          {activeTab === "profile" &&
            user && (
              <div className="sm-profile">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={
                    handleAvatarChange
                  }
                />

                <div className="sm-avatar-wrap">
                  <button
                    type="button"
                    className="sm-avatar"
                    onClick={
                      handleChooseAvatar
                    }
                    disabled={saving}
                  >
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="avatar"
                        className="sm-avatar-img"
                      />
                    ) : (
                      <span>
                        {getInitial()}
                      </span>
                    )}

                    <div className="sm-avatar-overlay">
                      {saving ? (
                        <i className="bi bi-arrow-repeat" />
                      ) : (
                        <i className="bi bi-camera" />
                      )}
                    </div>
                  </button>

                  <span className="sm-avatar-hint">
                    Click avatar to change
                    photo
                  </span>
                </div>

                <Form.Group className="sm-field">
                  <Form.Label className="sm-label">
                    Display Name
                  </Form.Label>

                  <Form.Control
                    className="sm-input"
                    value={form.name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name:
                          event.target
                            .value,
                      })
                    }
                  />
                </Form.Group>

                <Form.Group className="sm-field">
                  <Form.Label className="sm-label">
                    Email
                  </Form.Label>

                  <Form.Control
                    className="sm-input"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        email:
                          event.target
                            .value,
                      })
                    }
                  />
                </Form.Group>

                <Form.Group className="sm-field">
                  <Form.Label className="sm-label">
                    Bio
                  </Form.Label>

                  <Form.Control
                    as="textarea"
                    className="sm-input sm-textarea"
                    placeholder="Tell us a bit about yourself..."
                    value={form.bio}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        bio:
                          event.target
                            .value,
                      })
                    }
                  />
                </Form.Group>

                <Form.Group className="sm-field">
                  <Form.Label className="sm-label">
                    Role
                  </Form.Label>

                  <Form.Control
                    className="sm-input"
                    value={
                      user.role ||
                      "Member"
                    }
                    disabled
                  />
                </Form.Group>

                <Button
                  variant="primary"
                  className="sm-save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}