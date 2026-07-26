import { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import {
  uploadAvatar,
  getSubscriptionPlans,
  getUserStorage,
  getUpgradePreview,
  purchaseSubscriptionDemo,
  getPaymentHistory,
} from "../../../services/api";
import "./SettingsModal.scss";

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatMoney = (amount = 0) =>
  `${Number(amount || 0).toLocaleString("vi-VN")} ₫`;

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("vi-VN");
};

const applyThemeToDOM = (theme) => {
  const finalTheme = theme === "dark" ? "dark" : "light";

  localStorage.setItem("theme", finalTheme);
  document.documentElement.setAttribute("data-theme", finalTheme);

  if (finalTheme === "dark") {
    document.body.classList.add("dark");
    document.body.classList.add("theme-dark");
  } else {
    document.body.classList.remove("dark");
    document.body.classList.remove("dark-mode");
    document.body.classList.remove("theme-dark");
  }
};

export default function SettingsModal({ user, onClose, onSave }) {
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState(user ? "profile" : "appearance");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [chatLanguage, setChatLanguage] = useState(
    localStorage.getItem("chatLanguage") || "vi",
  );

  const [form, setForm] = useState({
    name: user?.name || user?.fullName || "",
    email: user?.email || "",
    bio: user?.bio || "",
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(
    user?.avatar_url || user?.avatarUrl || "",
  );
  const [saving, setSaving] = useState(false);

  const [plans, setPlans] = useState([]);
  const [storage, setStorage] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [upgradePreview, setUpgradePreview] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState("");

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("chatLanguage", chatLanguage);

    window.dispatchEvent(
      new CustomEvent("chatLanguageChanged", {
        detail: chatLanguage,
      }),
    );
  }, [chatLanguage]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);


  const loadPlanData = async () => {
    if (!user?.userId || user?.role !== "student") return;

    try {
      setPlanLoading(true);
      setPlanError("");

      const [plansResult, storageResult, paymentsResult] = await Promise.all([
        getSubscriptionPlans(),
        getUserStorage(user.userId),
        getPaymentHistory(user.userId),
      ]);

      setPlans(plansResult?.data || []);
      setStorage(storageResult?.data || null);
      setPaymentHistory(paymentsResult?.data || []);
    } catch (error) {
      console.error(error);
      setPlanError(error.message || "Không thể tải thông tin gói và dung lượng.");
    } finally {
      setPlanLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "plan" && user?.role === "student") {
      loadPlanData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.userId, user?.role]);

  const handlePreviewUpgrade = async (plan) => {
    if (!user?.userId || !plan?.planId) return;

    try {
      setPreviewLoading(true);
      setPlanError("");
      setPaymentSuccess("");
      setSelectedPlan(plan);
      setUpgradePreview(null);

      const result = await getUpgradePreview(user.userId, plan.planId);
      setUpgradePreview(result?.data || null);
    } catch (error) {
      console.error(error);
      setPlanError(error.message || "Không thể tính giá nâng cấp.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!user?.userId || !selectedPlan?.planId || !upgradePreview) return;

    const confirmed = window.confirm(
      `Xác nhận thanh toán mô phỏng ${formatMoney(
        upgradePreview.finalAmount,
      )} để kích hoạt gói ${selectedPlan.planName}?`,
    );

    if (!confirmed) return;

    try {
      setPaymentLoading(true);
      setPlanError("");
      setPaymentSuccess("");

      const result = await purchaseSubscriptionDemo(
        user.userId,
        selectedPlan.planId,
      );

      setPaymentSuccess(
        `Thanh toán demo thành công. Gói ${
          result?.data?.subscription?.planName || selectedPlan.planName
        } đã được kích hoạt.`,
      );

      setSelectedPlan(null);
      setUpgradePreview(null);
      await loadPlanData();
    } catch (error) {
      console.error(error);
      setPlanError(error.message || "Thanh toán không thành công.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme);
    applyThemeToDOM(nextTheme);
  };

  const getInitial = () => {
    return (
      form.name?.charAt(0)?.toUpperCase() ||
      user?.email?.charAt(0)?.toUpperCase() ||
      "U"
    );
  };

  const saveUserToStorage = (updatedUser) => {
    const finalUser = {
      ...updatedUser,
      name: updatedUser.name || updatedUser.fullName || form.name,
      fullName: updatedUser.fullName || updatedUser.name || form.name,
      email: updatedUser.email || form.email,
      bio: updatedUser.bio || form.bio,
      avatar_url: updatedUser.avatar_url || updatedUser.avatarUrl || "",
      avatarUrl: updatedUser.avatarUrl || updatedUser.avatar_url || "",
    };

    if (localStorage.getItem("currentUser")) {
      localStorage.setItem("currentUser", JSON.stringify(finalUser));
    }

    if (sessionStorage.getItem("currentUser")) {
      sessionStorage.setItem("currentUser", JSON.stringify(finalUser));
    }

    return finalUser;
  };

  const handleChooseAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB.");
      event.target.value = "";
      return;
    }

    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user?.userId) {
      alert("User ID not found.");
      return;
    }

    if (!form.name.trim()) {
      alert("Display name is required.");
      return;
    }

    if (!form.email.trim()) {
      alert("Email is required.");
      return;
    }

    try {
      setSaving(true);

      let updatedUser = {
        ...user,
        name: form.name.trim(),
        fullName: form.name.trim(),
        email: form.email.trim(),
        bio: form.bio,
      };

      if (avatarFile) {
        const avatarResult = await uploadAvatar(user.userId, avatarFile);

        if (!avatarResult.success) {
          throw new Error(
            avatarResult.detail ||
              avatarResult.message ||
              "Upload avatar failed.",
          );
        }

        updatedUser = {
          ...updatedUser,
          ...avatarResult.user,
          avatar_url: avatarResult.avatar_url || avatarResult.user?.avatar_url,
          avatarUrl: avatarResult.avatarUrl || avatarResult.user?.avatarUrl,
        };
      }

      const finalUser = saveUserToStorage(updatedUser);

      onSave?.(finalUser);
      onClose?.();
    } catch (error) {
      alert(error.message || "Save changes failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="sm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="sm-card">
        <div className="sm-header">
          <h2 className="sm-title">Settings</h2>

          <Button variant="light" className="sm-close" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </Button>
        </div>

        <div className="sm-tabs">
          {user && (
            <button
              type="button"
              className={`sm-tab ${
                activeTab === "profile" ? "sm-tab--active" : ""
              }`}
              onClick={() => setActiveTab("profile")}
            >
              <i className="bi bi-person"></i>
              Profile
            </button>
          )}

          <button
            type="button"
            className={`sm-tab ${
              activeTab === "appearance" ? "sm-tab--active" : ""
            }`}
            onClick={() => setActiveTab("appearance")}
          >
            <i className="bi bi-brightness-high"></i>
            Appearance
          </button>

          {user?.role === "student" && (
            <button
              type="button"
              className={`sm-tab ${
                activeTab === "plan" ? "sm-tab--active" : ""
              }`}
              onClick={() => {
                setActiveTab("plan");
                setSelectedPlan(null);
                setUpgradePreview(null);
                setPlanError("");
                setPaymentSuccess("");
              }}
            >
              <i className="bi bi-cloud"></i>
              Plan & Storage
            </button>
          )}
        </div>

        <div className="sm-body">
          {activeTab === "appearance" && (
            <div className="sm-appearance">
              <p className="sm-desc">Choose your preferred interface theme.</p>

              <div className="sm-theme-grid">
                <button
                  type="button"
                  className={`sm-theme-card ${
                    theme === "light" ? "sm-theme-card--active" : ""
                  }`}
                  onClick={() => handleThemeChange("light")}
                >
                  <div className="sm-theme-preview sm-theme-preview--light">
                    <i className="bi bi-sun"></i>
                  </div>

                  <div className="sm-theme-info">
                    <span className="sm-theme-name">Light</span>
                    <span className="sm-theme-desc">Default theme</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`sm-theme-card ${
                    theme === "dark" ? "sm-theme-card--active" : ""
                  }`}
                  onClick={() => handleThemeChange("dark")}
                >
                  <div className="sm-theme-preview sm-theme-preview--dark">
                    <i className="bi bi-moon"></i>
                  </div>

                  <div className="sm-theme-info">
                    <span className="sm-theme-name">Dark</span>
                    <span className="sm-theme-desc">Easy on the eyes</span>
                  </div>
                </button>
              </div>

              <div className="sm-language-section">
                <p className="sm-desc">Choose chatbot response language.</p>

                <div className="sm-language-grid">
                  <button
                    type="button"
                    className={`sm-language-card ${
                      chatLanguage === "vi"
                        ? "sm-language-card--active"
                        : ""
                    }`}
                    onClick={() => setChatLanguage("vi")}
                  >
                    <i className="bi bi-translate"></i>
                    <div>
                      <strong>Vietnamese</strong>
                      <span>Chatbot trả lời bằng tiếng Việt</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`sm-language-card ${
                      chatLanguage === "en"
                        ? "sm-language-card--active"
                        : ""
                    }`}
                    onClick={() => setChatLanguage("en")}
                  >
                    <i className="bi bi-translate"></i>
                    <div>
                      <strong>English</strong>
                      <span>Chatbot answers in English</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "plan" && user?.role === "student" && (
            <div className="sm-plan">
              <div className="sm-demo-notice">
                <i className="bi bi-info-circle"></i>
                <span>
                  Payment hiện là chế độ demo cho project, không trừ tiền ngân hàng thật.
                </span>
              </div>

              {planError && <div className="sm-plan-error">{planError}</div>}
              {paymentSuccess && (
                <div className="sm-plan-success">{paymentSuccess}</div>
              )}

              {planLoading ? (
                <div className="sm-plan-loading">Đang tải thông tin gói...</div>
              ) : (
                <>
                  {storage && (
                    <div className="sm-storage-card">
                      <div className="sm-storage-head">
                        <div>
                          <span className="sm-storage-label">Current plan</span>
                          <strong className="sm-storage-plan">
                            {storage.plan?.planName || "Free"}
                          </strong>
                        </div>

                        <span className="sm-storage-percent">
                          {Number(storage.percentage || 0).toFixed(1)}%
                        </span>
                      </div>

                      <div className="sm-storage-progress">
                        <div
                          className="sm-storage-progress__bar"
                          style={{
                            width: `${Math.min(
                              Number(storage.percentage || 0),
                              100,
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="sm-storage-meta">
                        <span>{formatBytes(storage.usedBytes)} used</span>
                        <span>{formatBytes(storage.limitBytes)} total</span>
                      </div>

                      <div className="sm-storage-docs">
                        {storage.documentCount || 0} documents
                        {storage.subscription?.endDate && (
                          <span>
                            Expires: {formatDate(storage.subscription.endDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="sm-plan-heading">
                    <h3>Choose your plan</h3>
                    <p>Nâng cấp để tăng giới hạn dung lượng lưu trữ.</p>
                  </div>

                  <div className="sm-plan-list">
                    {plans.map((plan) => {
                      const currentPrice = Number(storage?.plan?.price || 0);
                      const planPrice = Number(plan.price || 0);
                      const isCurrent =
                        Number(plan.planId) === Number(storage?.plan?.planId) ||
                        String(plan.planName || "").toLowerCase() ===
                          String(storage?.plan?.planName || "").toLowerCase();
                      const canUpgrade = !isCurrent && planPrice > currentPrice;

                      return (
                        <div
                          key={plan.planId}
                          className={`sm-plan-card ${
                            selectedPlan?.planId === plan.planId
                              ? "sm-plan-card--selected"
                              : ""
                          }`}
                        >
                          <div className="sm-plan-card__top">
                            <div>
                              <strong>{plan.planName}</strong>
                              <span>
                                {formatBytes(plan.storageLimitBytes)} storage
                              </span>
                            </div>

                            {isCurrent && (
                              <span className="sm-plan-current">Current</span>
                            )}
                          </div>

                          <div className="sm-plan-price">
                            {formatMoney(plan.price)}
                            {Number(plan.price || 0) > 0 && (
                              <span>/ {plan.durationDays} days</span>
                            )}
                          </div>

                          {plan.description && (
                            <p className="sm-plan-description">
                              {plan.description}
                            </p>
                          )}

                          <Button
                            type="button"
                            className="sm-plan-button"
                            disabled={!canUpgrade || previewLoading || paymentLoading}
                            onClick={() => handlePreviewUpgrade(plan)}
                          >
                            {isCurrent
                              ? "Current plan"
                              : canUpgrade
                                ? "Upgrade"
                                : "Not available"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {previewLoading && (
                    <div className="sm-plan-preview">
                      Đang tính số tiền cần thanh toán...
                    </div>
                  )}

                  {upgradePreview && !previewLoading && (
                    <div className="sm-plan-preview">
                      <div className="sm-plan-preview__title">
                        Payment summary
                      </div>

                      <div className="sm-plan-preview__row">
                        <span>Current plan</span>
                        <strong>{upgradePreview.currentPlan?.planName}</strong>
                      </div>

                      <div className="sm-plan-preview__row">
                        <span>New plan</span>
                        <strong>{upgradePreview.targetPlan?.planName}</strong>
                      </div>

                      {upgradePreview.type === "upgrade" && (
                        <>
                          <div className="sm-plan-preview__row">
                            <span>New plan cost for remaining time</span>
                            <strong>
                              {formatMoney(upgradePreview.originalAmount)}
                            </strong>
                          </div>

                          <div className="sm-plan-preview__row">
                            <span>Unused old-plan credit</span>
                            <strong>
                              -{formatMoney(upgradePreview.discountAmount)}
                            </strong>
                          </div>
                        </>
                      )}

                      <div className="sm-plan-preview__total">
                        <span>Pay now</span>
                        <strong>{formatMoney(upgradePreview.finalAmount)}</strong>
                      </div>

                      {upgradePreview.endDate && (
                        <div className="sm-plan-preview__note">
                          Upgrade giữ nguyên ngày hết hạn hiện tại: {" "}
                          {formatDate(upgradePreview.endDate)}
                        </div>
                      )}

                      <Button
                        type="button"
                        className="sm-pay-button"
                        onClick={handleConfirmPayment}
                        disabled={paymentLoading}
                      >
                        {paymentLoading
                          ? "Processing..."
                          : "Confirm & Pay (Demo)"}
                      </Button>
                    </div>
                  )}

                  <div className="sm-payment-history">
                    <div className="sm-plan-heading">
                      <h3>Payment history</h3>
                    </div>

                    {paymentHistory.length === 0 ? (
                      <div className="sm-payment-empty">No payments yet.</div>
                    ) : (
                      <div className="sm-payment-list">
                        {paymentHistory.slice(0, 8).map((payment) => (
                          <div className="sm-payment-item" key={payment.paymentId}>
                            <div>
                              <strong>{payment.planName || "Storage plan"}</strong>
                              <span>
                                {payment.paymentType === "upgrade"
                                  ? "Upgrade"
                                  : "New subscription"}
                                {" • "}
                                {formatDate(payment.paidAt || payment.createdAt)}
                              </span>
                            </div>

                            <div className="sm-payment-item__amount">
                              <strong>{formatMoney(payment.finalAmount)}</strong>
                              <span>{payment.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "profile" && user && (
            <div className="sm-profile">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarChange}
              />

              <div className="sm-avatar-wrap">
                <button
                  type="button"
                  className="sm-avatar"
                  onClick={handleChooseAvatar}
                  disabled={saving}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="avatar"
                      className="sm-avatar-img"
                    />
                  ) : (
                    <span>{getInitial()}</span>
                  )}

                  <div className="sm-avatar-overlay">
                    {saving ? (
                      <i className="bi bi-arrow-repeat"></i>
                    ) : (
                      <i className="bi bi-camera"></i>
                    )}
                  </div>
                </button>

                <span className="sm-avatar-hint">
                  Click avatar to change photo
                </span>
              </div>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Display Name</Form.Label>
                <Form.Control
                  className="sm-input"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                />
              </Form.Group>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Email</Form.Label>
                <Form.Control
                  className="sm-input"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                />
              </Form.Group>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Bio</Form.Label>
                <Form.Control
                  as="textarea"
                  className="sm-input sm-textarea"
                  placeholder="Tell us a bit about yourself..."
                  value={form.bio}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bio: e.target.value,
                    })
                  }
                />
              </Form.Group>

              <Form.Group className="sm-field">
                <Form.Label className="sm-label">Role</Form.Label>
                <Form.Control
                  className="sm-input"
                  value={user.role || "Member"}
                  disabled
                />
              </Form.Group>

              <Button
                variant="primary"
                className="sm-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}