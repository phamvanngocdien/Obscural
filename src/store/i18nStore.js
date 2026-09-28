import { create } from 'zustand';

/**
 * Internationalization (i18n) store for Obscural.
 * Supports: English (en) and Vietnamese (vi).
 */

const translations = {
  en: {
    // Sidebar / Navigation
    'nav.dashboard': 'Dashboard',
    'nav.invoice': 'Invoice',
    'nav.contact': 'Contact',
    'nav.analytics': 'Analytics',
    'nav.autopilot': 'Autopilot',
    'nav.settings': 'Settings',
    'nav.create': 'Create',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.loading': 'Loading...',
    'common.noData': 'No data available',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.amount': 'Amount',
    'common.date': 'Date',
    'common.back': 'Back',
    'common.confirm': 'Confirm',
    'common.export': 'Export',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.totalVolume': 'Total Volume',
    'dashboard.pending': 'Pending',
    'dashboard.paid': 'Paid',
    'dashboard.overdue': 'Overdue',
    'dashboard.recentInvoices': 'Recent Invoices',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.createInvoice': 'Create Invoice',
    'dashboard.viewAll': 'View All',

    // Invoice
    'invoice.title': 'Invoices',
    'invoice.create': 'Create Invoice',
    'invoice.exportCsv': 'Export CSV',
    'invoice.search': 'Search invoices...',
    'invoice.noInvoices': 'No invoices found',
    'invoice.all': 'All',
    'invoice.paid': 'Paid',
    'invoice.pending': 'Pending',
    'invoice.overdue': 'Overdue',
    'invoice.draft': 'Draft',
    'invoice.dueDate': 'Due Date',
    'invoice.createdAt': 'Created',

    // Analytics
    'analytics.title': 'Analytics & Ledger',
    'analytics.eyebrow': 'FINANCIAL TELEMETRY',
    'analytics.totalVolume': 'TOTAL VOLUME',
    'analytics.totalSettled': 'TOTAL SETTLED',
    'analytics.outstanding': 'OUTSTANDING',
    'analytics.settlementRate': 'SETTLEMENT RATE',
    'analytics.syncing': 'Synchronizing telemetry stream...',
    'analytics.cashFlow': 'CASH FLOW VELOCITY',
    'analytics.monthlyVolume': 'Monthly Volume Overview',
    'analytics.distribution': 'DISTRIBUTION',
    'analytics.settlementStatus': 'Settlement Status',
    'analytics.auditTrail': 'AUDIT TRAIL',
    'analytics.ledger': 'On-Chain Invoice Ledger',
    'analytics.noRecords': 'No telemetry records found',
    'analytics.createToPopulate': 'Create or settle an invoice to populate on-chain metrics',
    'analytics.allTime': 'All Time',
    'analytics.30d': '30 Days',
    'analytics.7d': '7 Days',

    // Contacts
    'contact.title': 'Contacts',
    'contact.addNew': 'Add Contact',
    'contact.search': 'Search contacts...',
    'contact.noContacts': 'No contacts found',
    'contact.myProfile': 'My Profile',

    // Settings
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.security': 'Security',
    'settings.notifications': 'Notifications',
    'settings.language': 'Language',
    'settings.wallet': 'Wallet',
    'settings.dangerZone': 'Danger Zone',
    'settings.displayName': 'Display Name',
    'settings.email': 'Email',
    'settings.location': 'Location',
    'settings.company': 'Company',
    'settings.saveProfile': 'Save Profile',
    'settings.saving': 'Saving...',
    'settings.twoFactor': 'Two-Factor Authentication',
    'settings.twoFactorDesc': 'Add an extra layer of security to your account',
    'settings.sessionTimeout': 'Session Timeout',
    'settings.sessionTimeoutDesc': 'Automatically log out after 30 minutes of inactivity',
    'settings.loginAlerts': 'Login Alerts',
    'settings.loginAlertsDesc': 'Get notified when someone logs in from a new device',
    'settings.emailReminders': 'Email Reminders',
    'settings.emailRemindersDesc': 'Receive email reminders for pending invoices',
    'settings.paymentAlerts': 'Payment Alerts',
    'settings.paymentAlertsDesc': 'Instant notification when a payment is received',
    'settings.weeklyReport': 'Weekly Report',
    'settings.weeklyReportDesc': 'Get a weekly summary of your invoice activity',
    'settings.connectedWallet': 'Connected Wallet',
    'settings.disconnect': 'Disconnect',
    'settings.connectWallet': 'Connect Wallet',
    'settings.clearData': 'Clear Data',
    'settings.clearDataLabel': 'Clear All Local Data',
    'settings.clearDataDesc': 'This will remove all cached invoices, contacts, and settings',
    'settings.clearDataConfirm': 'Are you sure you want to clear all local data? This cannot be undone.',
    'settings.languageLabel': 'Interface Language',
    'settings.languageDesc': 'Choose your preferred language for the interface',
    'settings.logout': 'Log Out',

    // Autopilot
    'autopilot.title': 'Autopilot',
    'autopilot.trustMatrix': 'Trust Matrix',

    // Topbar & Notifications
    'topbar.notifications': 'Notifications',
    'topbar.markAllRead': 'Mark all read',
    'topbar.welcomeTitle': 'Welcome to Obscural',
    'topbar.welcomeDesc': 'Create smart on-chain invoices and manage payments seamlessly.',

    // Landing
    'landing.launch': 'Launch App',
    'landing.loginEmail': 'Sign in with Email',
    'landing.loginGoogle': 'Continue with Google',
    'landing.tagline': 'Smart Invoices on Rialo',
    'landing.heroDesc1': 'Obscural is a Smart Invoices platform on Rialo.',
    'landing.heroDesc2': 'Create, send, and receive secure payments with end-to-end encryption.',
    'landing.ready': 'Ready to start?',
    'landing.readySub': 'Sign in with your email or Google account.',
    'landing.signIn': 'Sign In',

    // Landing Metrics
    'landing.metricNonCustodial': 'Non-Custodial',
    'landing.metricNonCustodialSub': 'Smart Contract Vaults',
    'landing.metricPrivacy': 'Privacy Standard',
    'landing.metricPrivacySub': 'Encrypted Invoices',
    'landing.metricSpeed': 'Settlement Speed',
    'landing.metricSpeedSub': 'Rialo Fast Finality',
    'landing.metricAutomation': 'Automation',
    'landing.metricAutomationSub': 'Autopilot Trust Matrix',

    // Landing Features
    'landing.featuresEyebrow': 'PLATFORM ARCHITECTURE',
    'landing.featuresTitle': 'Built for Modern On-Chain Commerce',
    'landing.featuresSubtitle': 'Comprehensive overview of the Obscural invoicing and smart payment suite.',
    'landing.feat1Badge': 'CORE INVOICING',
    'landing.feat1Title': 'Smart Invoices on Rialo',
    'landing.feat1Desc': 'Create, send, and track cryptographic invoices with end-to-end encryption, multi-currency support, and instant verification.',
    'landing.feat1Tag': 'Zero Exposure',
    'landing.feat2Badge': 'ESCROW & VAULT',
    'landing.feat2Title': 'Escrow Vault & Bill Splitter',
    'landing.feat2Desc': 'Trustless funds custody governed by EscrowVault.sol and automated multi-party distribution with BillSplitter.sol.',
    'landing.feat2Tag': 'Programmable',
    'landing.feat3Badge': 'INTELLIGENCE',
    'landing.feat3Title': 'Autopilot Trust Matrix',
    'landing.feat3Desc': 'Continuous counterparty evaluation, automatic risk scoring, and rule-based autonomous settlement policies.',
    'landing.feat3Tag': 'Autonomous',
    'landing.feat4Badge': 'TELEMETRY',
    'landing.feat4Title': 'Real-Time Analytics',
    'landing.feat4Desc': 'Transparent on-chain metrics, cash flow telemetry, transaction provenance, and volume breakdown in real time.',
    'landing.feat4Tag': 'Live Telemetry',
    'landing.feat5Badge': 'ADDRESS BOOK',
    'landing.feat5Title': 'Encrypted Contact Directory',
    'landing.feat5Desc': 'Maintain verified counterparties, recipient wallet aliases, and customized trust thresholds with full privacy.',
    'landing.feat5Tag': 'Verified',
    'landing.feat6Badge': 'ASSISTANT',
    'landing.feat6Title': 'Invoicing AI Copilot',
    'landing.feat6Desc': 'Interactive intelligent assistant to query pending bills, draft custom items, and trigger rapid evaluations effortlessly.',
    'landing.feat6Tag': 'Natural Language',

    // Landing Workflow
    'landing.workflowEyebrow': 'PROTOCOL HORIZON',
    'landing.workflowTitle': 'How Obscural Works',
    'landing.workflowSubtitle': 'From contract drafting to autonomous trustless escrow release in 3 steps.',
    'landing.wf1Title': 'Create & Encrypt',
    'landing.wf1Desc': 'Define items, tax, due dates, and counterparties. Data is encrypted end-to-end before on-chain registration.',
    'landing.wf2Title': 'Escrow & Verification',
    'landing.wf2Desc': 'Funds are securely routed into EscrowVault.sol. Release occurs automatically upon fulfillment verification.',
    'landing.wf3Title': 'Autonomous Settlement',
    'landing.wf3Desc': 'Autopilot matrix inspects counterparty score and executes instant payments based on your customized safety rules.',

    // Landing Cockpit & Footer
    'landing.cockpitEyebrow': 'DECENTRALIZED INVOICING',
    'landing.cockpitTitle': 'Experience Immersive Invoicing',
    'landing.cockpitDesc': 'Join the next generation of privacy-preserving smart contract settlement on Rialo.',
    'landing.footer': '© 2026 Obscural. Powered by Rialo. All rights reserved.',

    // Auth
    'auth.logout': 'Log Out',
    'auth.logoutSuccess': 'Logged out successfully',
  },

  vi: {
    // Sidebar / Navigation
    'nav.dashboard': 'Tổng quan',
    'nav.invoice': 'Hóa đơn',
    'nav.contact': 'Liên hệ',
    'nav.analytics': 'Phân tích',
    'nav.autopilot': 'Tự động',
    'nav.settings': 'Cài đặt',
    'nav.create': 'Tạo mới',

    // Common
    'common.save': 'Lưu',
    'common.cancel': 'Hủy',
    'common.delete': 'Xóa',
    'common.edit': 'Sửa',
    'common.search': 'Tìm kiếm',
    'common.loading': 'Đang tải...',
    'common.noData': 'Không có dữ liệu',
    'common.actions': 'Hành động',
    'common.status': 'Trạng thái',
    'common.amount': 'Số tiền',
    'common.date': 'Ngày',
    'common.back': 'Quay lại',
    'common.confirm': 'Xác nhận',
    'common.export': 'Xuất',

    // Dashboard
    'dashboard.title': 'Tổng quan',
    'dashboard.welcome': 'Chào mừng trở lại',
    'dashboard.totalVolume': 'Tổng giá trị',
    'dashboard.pending': 'Chờ xử lý',
    'dashboard.paid': 'Đã thanh toán',
    'dashboard.overdue': 'Quá hạn',
    'dashboard.recentInvoices': 'Hóa đơn gần đây',
    'dashboard.quickActions': 'Thao tác nhanh',
    'dashboard.createInvoice': 'Tạo hóa đơn',
    'dashboard.viewAll': 'Xem tất cả',

    // Invoice
    'invoice.title': 'Hóa đơn',
    'invoice.create': 'Tạo hóa đơn',
    'invoice.exportCsv': 'Xuất CSV',
    'invoice.search': 'Tìm kiếm hóa đơn...',
    'invoice.noInvoices': 'Không tìm thấy hóa đơn',
    'invoice.all': 'Tất cả',
    'invoice.paid': 'Đã thanh toán',
    'invoice.pending': 'Chờ xử lý',
    'invoice.overdue': 'Quá hạn',
    'invoice.draft': 'Nháp',
    'invoice.dueDate': 'Hạn thanh toán',
    'invoice.createdAt': 'Ngày tạo',

    // Analytics
    'analytics.title': 'Phân tích & Sổ cái',
    'analytics.eyebrow': 'PHÂN TÍCH TÀI CHÍNH',
    'analytics.totalVolume': 'TỔNG GIÁ TRỊ',
    'analytics.totalSettled': 'ĐÃ THANH TOÁN',
    'analytics.outstanding': 'CÒN TỒN ĐỌNG',
    'analytics.settlementRate': 'TỈ LỆ THANH TOÁN',
    'analytics.syncing': 'Đang đồng bộ dữ liệu...',
    'analytics.cashFlow': 'DÒNG TIỀN',
    'analytics.monthlyVolume': 'Tổng quan theo tháng',
    'analytics.distribution': 'PHÂN BỐ',
    'analytics.settlementStatus': 'Trạng thái thanh toán',
    'analytics.auditTrail': 'LỊCH SỬ GIAO DỊCH',
    'analytics.ledger': 'Sổ cái hóa đơn On-Chain',
    'analytics.noRecords': 'Không có dữ liệu',
    'analytics.createToPopulate': 'Tạo hoặc thanh toán hóa đơn để xem dữ liệu',
    'analytics.allTime': 'Tất cả',
    'analytics.30d': '30 ngày',
    'analytics.7d': '7 ngày',

    // Contacts
    'contact.title': 'Liên hệ',
    'contact.addNew': 'Thêm liên hệ',
    'contact.search': 'Tìm kiếm liên hệ...',
    'contact.noContacts': 'Không tìm thấy liên hệ',
    'contact.myProfile': 'Hồ sơ của tôi',

    // Settings
    'settings.title': 'Cài đặt',
    'settings.profile': 'Hồ sơ',
    'settings.security': 'Bảo mật',
    'settings.notifications': 'Thông báo',
    'settings.language': 'Ngôn ngữ',
    'settings.wallet': 'Ví',
    'settings.dangerZone': 'Khu vực nguy hiểm',
    'settings.displayName': 'Tên hiển thị',
    'settings.email': 'Email',
    'settings.location': 'Địa chỉ',
    'settings.company': 'Công ty',
    'settings.saveProfile': 'Lưu hồ sơ',
    'settings.saving': 'Đang lưu...',
    'settings.twoFactor': 'Xác thực hai bước',
    'settings.twoFactorDesc': 'Thêm lớp bảo mật cho tài khoản của bạn',
    'settings.sessionTimeout': 'Hết phiên đăng nhập',
    'settings.sessionTimeoutDesc': 'Tự động đăng xuất sau 30 phút không hoạt động',
    'settings.loginAlerts': 'Cảnh báo đăng nhập',
    'settings.loginAlertsDesc': 'Nhận thông báo khi có ai đăng nhập từ thiết bị mới',
    'settings.emailReminders': 'Nhắc nhở qua email',
    'settings.emailRemindersDesc': 'Nhận email nhắc nhở cho hóa đơn chưa thanh toán',
    'settings.paymentAlerts': 'Cảnh báo thanh toán',
    'settings.paymentAlertsDesc': 'Nhận thông báo khi có thanh toán mới',
    'settings.weeklyReport': 'Báo cáo hàng tuần',
    'settings.weeklyReportDesc': 'Nhận tóm tắt hoạt động hóa đơn hàng tuần',
    'settings.connectedWallet': 'Ví đã kết nối',
    'settings.disconnect': 'Ngắt kết nối',
    'settings.connectWallet': 'Kết nối ví',
    'settings.clearData': 'Xóa dữ liệu',
    'settings.clearDataLabel': 'Xóa tất cả dữ liệu cục bộ',
    'settings.clearDataDesc': 'Thao tác này sẽ xóa tất cả hóa đơn, liên hệ và cài đặt đã lưu',
    'settings.clearDataConfirm': 'Bạn có chắc muốn xóa tất cả dữ liệu cục bộ? Thao tác này không thể hoàn tác.',
    'settings.languageLabel': 'Ngôn ngữ giao diện',
    'settings.languageDesc': 'Chọn ngôn ngữ hiển thị cho giao diện',
    'settings.logout': 'Đăng xuất',

    // Autopilot
    'autopilot.title': 'Tự động hóa',
    'autopilot.trustMatrix': 'Ma trận tín nhiệm',

    // Topbar & Notifications
    'topbar.notifications': 'Thông báo',
    'topbar.markAllRead': 'Đánh dấu đã đọc',
    'topbar.welcomeTitle': 'Chào mừng đến với Obscural',
    'topbar.welcomeDesc': 'Tạo hóa đơn thông minh on-chain và quản lý thanh toán liền mạch.',

    // Landing
    'landing.launch': 'Bắt đầu',
    'landing.loginEmail': 'Đăng nhập bằng Email',
    'landing.loginGoogle': 'Đăng nhập bằng Google',
    'landing.tagline': 'Hóa đơn thông minh trên Rialo',
    'landing.heroDesc1': 'Obscural là nền tảng hóa đơn thông minh trên mạng lưới Rialo.',
    'landing.heroDesc2': 'Tạo, gửi và nhận thanh toán an toàn với mã hóa đầu cuối.',
    'landing.ready': 'Sẵn sàng bắt đầu?',
    'landing.readySub': 'Đăng nhập bằng email hoặc Google để bắt đầu.',
    'landing.signIn': 'Đăng nhập',

    // Landing Metrics
    'landing.metricNonCustodial': 'Phi lưu ký',
    'landing.metricNonCustodialSub': 'Kho lưu trữ HĐTM',
    'landing.metricPrivacy': 'Bảo mật E2E',
    'landing.metricPrivacySub': 'Hóa đơn mã hóa',
    'landing.metricSpeed': 'Tốc độ quyết toán',
    'landing.metricSpeedSub': 'Xác nhận tức thì trên Rialo',
    'landing.metricAutomation': 'Tự động hóa',
    'landing.metricAutomationSub': 'Ma trận tín nhiệm Autopilot',

    // Landing Features
    'landing.featuresEyebrow': 'KIẾN TRÚC NỀN TẢNG',
    'landing.featuresTitle': 'Xây dựng cho thương mại On-Chain hiện đại',
    'landing.featuresSubtitle': 'Tổng quan toàn diện về bộ giải pháp hóa đơn và thanh toán thông minh Obscural.',
    'landing.feat1Badge': 'HÓA ĐƠN CỐT LÕI',
    'landing.feat1Title': 'Hóa đơn thông minh trên Rialo',
    'landing.feat1Desc': 'Tạo, gửi và theo dõi hóa đơn mã hóa với bảo mật đầu cuối, hỗ trợ đa tiền tệ và xác thực tức thì.',
    'landing.feat1Tag': 'Không lộ thông tin',
    'landing.feat2Badge': 'KÝ QUỸ & KHO TIỀN',
    'landing.feat2Title': 'Kho ký quỹ & Chia hóa đơn',
    'landing.feat2Desc': 'Quản lý dòng tiền phi tín nhiệm qua EscrowVault.sol và tự động phân bổ đa bên với BillSplitter.sol.',
    'landing.feat2Tag': 'Lập trình linh hoạt',
    'landing.feat3Badge': 'TRÍ TUỆ NHÂN TẠO',
    'landing.feat3Title': 'Ma trận tín nhiệm Autopilot',
    'landing.feat3Desc': 'Đánh giá đối tác liên tục, chấm điểm rủi ro tự động và chính sách thanh toán tự trị theo quy tắc an toàn.',
    'landing.feat3Tag': 'Tự trị',
    'landing.feat4Badge': 'DỮ LIỆU ĐO ĐẠC',
    'landing.feat4Title': 'Phân tích thời gian thực',
    'landing.feat4Desc': 'Dữ liệu on-chain minh bạch, dòng tiền trực quan, nguồn gốc giao dịch và phân tích khối lượng tức thời.',
    'landing.feat4Tag': 'Dữ liệu trực tiếp',
    'landing.feat5Badge': 'DANH BẠ',
    'landing.feat5Title': 'Danh bạ liên hệ mã hóa',
    'landing.feat5Desc': 'Quản lý đối tác đã xác minh, tên gợi nhớ địa chỉ ví và ngưỡng tín nhiệm tùy chỉnh với bảo mật tuyệt đối.',
    'landing.feat5Tag': 'Đã xác minh',
    'landing.feat6Badge': 'TRỢ LÝ AI',
    'landing.feat6Title': 'Trợ lý ảo AI hóa đơn',
    'landing.feat6Desc': 'Trợ lý thông minh tra cứu hóa đơn chờ xử lý, soạn thảo mục hóa đơn và hỗ trợ đánh giá nhanh chóng.',
    'landing.feat6Tag': 'Ngôn ngữ tự nhiên',

    // Landing Workflow
    'landing.workflowEyebrow': 'TIẾN TRÌNH GIAO THỨC',
    'landing.workflowTitle': 'Cách thức hoạt động của Obscural',
    'landing.workflowSubtitle': 'Từ soạn thảo hợp đồng đến giải ngân ký quỹ tự động trong 3 bước.',
    'landing.wf1Title': 'Tạo & Mã hóa',
    'landing.wf1Desc': 'Thiết lập danh mục, thuế, hạn thanh toán và đối tác. Dữ liệu được mã hóa đầu cuối trước khi ghi nhận on-chain.',
    'landing.wf2Title': 'Ký quỹ & Xác thực',
    'landing.wf2Desc': 'Tiền được lưu giữ an toàn trong EscrowVault.sol và tự động giải ngân khi điều kiện nghiệm thu hoàn tất.',
    'landing.wf3Title': 'Quyết toán tự trị',
    'landing.wf3Desc': 'Ma trận Autopilot kiểm tra điểm tín nhiệm đối tác và giải ngân tức thì dựa trên quy tắc an toàn của bạn.',

    // Landing Cockpit & Footer
    'landing.cockpitEyebrow': 'HÓA ĐƠN PHI TẬP TRUNG',
    'landing.cockpitTitle': 'Trải nghiệm hóa đơn thế hệ mới',
    'landing.cockpitDesc': 'Gia nhập thế hệ quyết toán hợp đồng thông minh bảo mật quyền riêng tư trên Rialo.',
    'landing.footer': '© 2026 Obscural. Vận hành bởi Rialo. Bảo lưu mọi quyền.',

    // Auth
    'auth.logout': 'Đăng xuất',
    'auth.logoutSuccess': 'Đăng xuất thành công',
  },
};

const STORAGE_KEY = 'obscural_language';

const useI18nStore = create((set, get) => ({
  locale: localStorage.getItem(STORAGE_KEY) || 'vi',

  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale);
    set({ locale });
  },

  t: (key) => {
    const { locale } = get();
    return translations[locale]?.[key] || translations.en?.[key] || key;
  },
}));

export default useI18nStore;
