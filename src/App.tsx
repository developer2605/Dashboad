import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  FilterX,
  Link as LinkIcon,
  Lock,
  LogOut,
  MailCheck,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Trash2,
  UserCog,
  UserPlus,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { firebaseServices, isFirebaseEnabled } from "./firebaseClient";

type DimensionKey = "page" | "adAccount" | "service";
type SortDirection = "asc" | "desc";
type PerformanceSortKey =
  | "page"
  | "service"
  | "adId"
  | "adAccount"
  | "spend"
  | "messages"
  | "comments"
  | "phoneCount";
type PhoneSortKey =
  | "adId"
  | "adAccount"
  | "phoneList"
  | "page"
  | "service";
type TopMetric = "messages" | "leads" | "spend";

interface PerformanceRecord {
  id: string;
  sourceRow: number;
  date: string;
  dateLabel: string;
  page: string;
  adAccount: string;
  service: string;
  spend: number;
  messages: number;
  comments: number;
  phoneCount: number;
  adId: string;
}

interface PhoneRecord {
  id: string;
  sourceRow: number;
  date: string;
  dateLabel: string;
  phoneRaw: string;
  phone: string;
  normalizedPhone: string;
  adId: string;
  adAccount: string;
  page: string;
  service: string;
  gender: string;
}

interface Filters {
  startDate: string;
  endDate: string;
  page: string;
  adAccount: string;
  service: string;
  gender: string;
  adId: string;
}

interface MetricSummary {
  spend: number;
  messages: number;
  comments: number;
  leads: number;
  validPhones: number;
  uniquePhones: number;
  phonePerMessage: number;
  costPerMessage: number;
  costPerLead: number;
}

interface LoadState {
  status: "loading" | "ready" | "error";
  source: "sheet" | "sample";
  message: string;
}

interface PerformanceTableRow {
  id: string;
  page: string;
  service: string;
  adId: string;
  adAccount: string;
  spend: number;
  messages: number;
  comments: number;
  phoneCount: number;
}

interface PhoneTableRow {
  id: string;
  phoneList: string;
  adId: string;
  adAccount: string;
  page: string;
  service: string;
}

type AccountRole = "admin" | "user";
type AccountState =
  | "admin"
  | "pending_email"
  | "pending_admin"
  | "active"
  | "expired";
type AuthMode = "login" | "register" | "forgot" | "reset";

interface AccountRecord {
  id: string;
  email: string;
  password?: string;
  displayName: string;
  role: AccountRole;
  createdAt: string;
  emailVerifiedAt?: string;
  verificationCode?: string;
  passwordResetCode?: string;
  passwordResetRequestedAt?: string;
  activatedAt?: string;
  expiresAt?: string;
  note?: string;
}

interface AuthFormState {
  email: string;
  password: string;
  displayName: string;
  verificationCode: string;
  resetCode: string;
}

const LEGACY_CSV_URL = import.meta.env.VITE_SHEET_CSV_URL?.trim();
const PERFORMANCE_CSV_URL =
  import.meta.env.VITE_PERFORMANCE_SHEET_CSV_URL?.trim() || LEGACY_CSV_URL || "";
const PHONE_CSV_URL = import.meta.env.VITE_PHONE_SHEET_CSV_URL?.trim() || "";
const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL?.trim() ||
  import.meta.env.VITE_ADMIN_USERNAME?.trim() ||
  "admin@gmail.com";
const ADMIN_PASSWORD =
  import.meta.env.VITE_ADMIN_PASSWORD?.trim() || "admin123";
const ADMIN_PHONE = import.meta.env.VITE_ADMIN_PHONE?.trim() || "";
const ADMIN_TELEGRAM = import.meta.env.VITE_ADMIN_TELEGRAM?.trim() || "";
const ADMIN_ZALO = import.meta.env.VITE_ADMIN_ZALO?.trim() || "";
const ADMIN_FACEBOOK = import.meta.env.VITE_ADMIN_FACEBOOK?.trim() || "";
const LEGACY_SHEET_URL_STORAGE_KEY = "ads-dashboard-sheet-url";
const PERFORMANCE_SHEET_URL_STORAGE_KEY =
  "ads-dashboard-performance-sheet-url";
const PHONE_SHEET_URL_STORAGE_KEY = "ads-dashboard-phone-sheet-url";
const PERFORMANCE_TEMPLATE_FILENAME = "mau-nguon-hieu-qua-ads.tsv";
const PHONE_TEMPLATE_FILENAME = "mau-nguon-danh-sach-sdt.tsv";
const ACCOUNTS_STORAGE_KEY = "ads-dashboard-accounts";
const CURRENT_ACCOUNT_STORAGE_KEY = "ads-dashboard-current-account-id";
const FIRESTORE_ACCOUNTS_COLLECTION = "accounts";

const DEFAULT_AUTH_FORM: AuthFormState = {
  email: "",
  password: "",
  displayName: "",
  verificationCode: "",
  resetCode: "",
};

const EMPTY_FILTERS: Filters = {
  startDate: "",
  endDate: "",
  page: "",
  adAccount: "",
  service: "",
  gender: "",
  adId: "",
};

const COLUMN_ALIASES = {
  date: ["date", "ngay", "ngày", "thoi gian", "thời gian"],
  page: ["page", "fanpage", "trang", "ten page", "tên page"],
  adAccount: [
    "adAccount",
    "ad account",
    "account",
    "tai khoan",
    "tài khoản",
    "tai khoan quang cao",
    "tài khoản quảng cáo",
    "tkqc",
  ],
  service: ["service", "dich vu", "dịch vụ", "san pham", "sản phẩm"],
  spend: [
    "spend",
    "amount spent",
    "cost",
    "chi tieu",
    "chi tiêu",
    "chi phi",
    "chi phí",
    "so tien chi tieu",
    "số tiền chi tiêu",
  ],
  messages: [
    "messages",
    "message",
    "mess",
    "tin nhan",
    "tin nhắn",
    "so mess",
    "số mess",
  ],
  comments: [
    "comments",
    "comment",
    "binh luan",
    "bình luận",
    "so binh luan",
    "số bình luận",
  ],
  phone: [
    "phone",
    "sdt",
    "sđt",
    "dien thoai",
    "điện thoại",
    "so dien thoai",
    "số điện thoại",
  ],
  phoneCount: [
    "phoneCount",
    "phone count",
    "lead",
    "leads",
    "so luong sdt",
    "so luong so dien thoai",
    "số lượng sđt",
    "số lượng số điện thoại",
  ],
  adId: ["adId", "ad id", "ad_id", "ads id", "id ads", "id quang cao"],
  gender: ["gender", "gioi tinh", "giới tính", "sex"],
} as const;

const SAMPLE_PERFORMANCE_TSV = `date	adId	spend	messages	comments	phoneCount	adAccount	page	service
01/06/2026	AD-1001	1250000	34	12	2	TKQC 01	Page Ha Noi	IVF
01/06/2026	AD-1002	860000	21	8	1	TKQC 02	Page Sai Gon	Nha khoa
02/06/2026	AD-1001	1430000	42	15	1	TKQC 01	Page Ha Noi	IVF
02/06/2026	AD-1003	540000	12	4	0	TKQC 03	Page Da Nang	Da lieu
03/06/2026	AD-1004	975000	27	11	1	TKQC 02	Page Sai Gon	Nha khoa
04/06/2026	AD-1005	1120000	29	9	1	TKQC 04	Page Ha Noi	Da lieu
05/06/2026	AD-1006	1760000	48	20	2	TKQC 03	Page Da Nang	IVF
06/06/2026	AD-1007	690000	18	7	1	TKQC 01	Page Ha Noi	Nha khoa
07/06/2026	AD-1008	2120000	55	24	1	TKQC 02	Page Sai Gon	IVF
08/06/2026	AD-1003	730000	17	6	1	TKQC 03	Page Da Nang	Da lieu`;

const SAMPLE_PHONE_TSV = `date	phone	adId	adAccount	page	service	gender
01/06/2026	0981234567, 0981234568	AD-1001	TKQC 01	Page Ha Noi	IVF	Nu
01/06/2026	0912345678	AD-1002	TKQC 02	Page Sai Gon	Nha khoa	Nam
02/06/2026	+84981234568	AD-1001	TKQC 01	Page Ha Noi	IVF	Nu
03/06/2026	0901122334	AD-1004	TKQC 02	Page Sai Gon	Nha khoa	Nu
04/06/2026	0934556677	AD-1005	TKQC 04	Page Ha Noi	Da lieu	Nam
05/06/2026	0977888999; 0977888998	AD-1006	TKQC 03	Page Da Nang	IVF	Nu
06/06/2026	0888123456	AD-1007	TKQC 01	Page Ha Noi	Nha khoa	Nam
07/06/2026	0912345678	AD-1008	TKQC 02	Page Sai Gon	IVF	Nu
08/06/2026	0845566778	AD-1003	TKQC 03	Page Da Nang	Da lieu	Nu`;

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const GENDER_COLORS: Record<string, string> = {
  "Nữ": "#d14b7a",
  Nam: "#2766c2",
  "Khác": "#7a5af8",
  "Chưa rõ": "#6b7280",
};

const CHART_COLORS = {
  spend: "#2364aa",
  messages: "#2f9e44",
  comments: "#d97706",
  leads: "#c2410c",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const PERFORMANCE_TABLE_COLUMNS: Array<{
  key: PerformanceSortKey;
  label: string;
  align?: "right";
}> = [
  { key: "adId", label: "Ad ID Ads" },
  { key: "page", label: "Page" },
  { key: "service", label: "Dịch vụ" },
  { key: "adAccount", label: "Tài khoản quảng cáo" },
  { key: "spend", label: "Số tiền chi tiêu", align: "right" },
  { key: "messages", label: "Mess", align: "right" },
  { key: "comments", label: "Bình luận", align: "right" },
  { key: "phoneCount", label: "Số lượng SĐT", align: "right" },
];

const PHONE_TABLE_COLUMNS: Array<{
  key: PhoneSortKey;
  label: string;
  align?: "right";
}> = [
  { key: "phoneList", label: "Danh sách SĐT" },
  { key: "adId", label: "Ad ID Ads" },
  { key: "adAccount", label: "Tài khoản quảng cáo" },
  { key: "page", label: "Page" },
  { key: "service", label: "Dịch vụ" },
];

function App() {
  const [performanceRecords, setPerformanceRecords] = useState<
    PerformanceRecord[]
  >([]);
  const [phoneRecords, setPhoneRecords] = useState<PhoneRecord[]>([]);
  const [performanceSheetUrlInput, setPerformanceSheetUrlInput] = useState(
    readInitialPerformanceSheetUrl,
  );
  const [phoneSheetUrlInput, setPhoneSheetUrlInput] = useState(
    readInitialPhoneSheetUrl,
  );
  const [activePerformanceSheetUrl, setActivePerformanceSheetUrl] = useState(
    readInitialPerformanceSheetUrl,
  );
  const [activePhoneSheetUrl, setActivePhoneSheetUrl] = useState(
    readInitialPhoneSheetUrl,
  );
  const [accounts, setAccounts] = useState<AccountRecord[]>(() =>
    isFirebaseEnabled ? [] : readStoredAccounts(),
  );
  const [currentAccountId, setCurrentAccountId] = useState(() =>
    isFirebaseEnabled ? "" : readCurrentAccountId(),
  );
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isFirebaseEnabled);
  const [isAccountSyncReady, setIsAccountSyncReady] =
    useState(!isFirebaseEnabled);
  const [authForm, setAuthForm] = useState<AuthFormState>(DEFAULT_AUTH_FORM);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authMessage, setAuthMessage] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState(false);
  const [adminDurationDays, setAdminDurationDays] = useState(30);
  const [performanceLoadState, setPerformanceLoadState] = useState<LoadState>(() => {
    const initialSheetUrl = readInitialPerformanceSheetUrl();
    return {
      status: "loading",
      source: initialSheetUrl ? "sheet" : "sample",
      message: "Dang tai nguon hieu qua ads",
    };
  });
  const [phoneLoadState, setPhoneLoadState] = useState<LoadState>(() => {
    const initialSheetUrl = readInitialPhoneSheetUrl();
    return {
      status: "loading",
      source: initialSheetUrl ? "sheet" : "sample",
      message: "Dang tai nguon danh sach SDT",
    };
  });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [performanceSortKey, setPerformanceSortKey] =
    useState<PerformanceSortKey>("spend");
  const [performanceSortDirection, setPerformanceSortDirection] =
    useState<SortDirection>("desc");
  const [phoneSortKey, setPhoneSortKey] = useState<PhoneSortKey>("phoneList");
  const [phoneSortDirection, setPhoneSortDirection] =
    useState<SortDirection>("asc");
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);
  const [phonePage, setPhonePage] = useState(1);
  const [phonePageSize, setPhonePageSize] = useState(10);
  const [dimension, setDimension] = useState<DimensionKey>("page");
  const [topMetric, setTopMetric] = useState<TopMetric>("leads");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!isFirebaseEnabled) {
      saveStoredAccounts(accounts);
    }
  }, [accounts]);

  useEffect(() => {
    if (!firebaseServices) return;

    return onAuthStateChanged(firebaseServices.auth, (user) => {
      setFirebaseUser(user);
      setCurrentAccountId(user?.uid ?? "");
      setIsAuthReady(true);
      setIsAccountSyncReady(!user);
      if (!user) {
        setAccounts([]);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseServices) return;

    if (!firebaseUser) {
      setAccounts([]);
      setIsAccountSyncReady(true);
      return;
    }

    setIsAccountSyncReady(false);
    const accountRef = doc(
      firebaseServices.db,
      FIRESTORE_ACCOUNTS_COLLECTION,
      firebaseUser.uid,
    );

    return onSnapshot(
      accountRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          void createOrUpdateFirebaseAccountProfile(firebaseUser);
          return;
        }

        const account = accountFromFirestoreDoc(
          snapshot.id,
          snapshot.data(),
        );

        if (firebaseUser.emailVerified && !account.emailVerifiedAt) {
          void updateDoc(accountRef, {
            emailVerifiedAt: new Date().toISOString(),
          });
          return;
        }

        setAccounts((current) => mergeAccountRecord(current, account));
        setCurrentAccountId(firebaseUser.uid);
        setIsAccountSyncReady(true);
      },
      (error) => {
        setAccountMessage(firebaseErrorToMessage(error));
        setIsAccountSyncReady(true);
      },
    );
  }, [firebaseUser]);

  useEffect(() => {
    let cancelled = false;
    const sheetUrl = activePerformanceSheetUrl.trim();

    async function loadPerformanceData() {
      setPerformanceLoadState({
        status: "loading",
        source: sheetUrl ? "sheet" : "sample",
        message: sheetUrl
          ? "Dang tai nguon hieu qua ads"
          : "Dang dung mau nguon hieu qua ads",
      });

      try {
        const csv = sheetUrl
          ? await fetchCsv(resolveGoogleSheetCsvUrl(sheetUrl))
          : SAMPLE_PERFORMANCE_TSV;
        const parsedRecords = parsePerformanceCsvToRecords(csv);

        if (!cancelled) {
          setPerformanceRecords(parsedRecords);
          setPerformanceLoadState({
            status: "ready",
            source: sheetUrl ? "sheet" : "sample",
            message: sheetUrl
              ? `Nguon ads: ${numberFormatter.format(parsedRecords.length)} dong`
              : "Nguon ads dang dung du lieu mau",
          });
        }
      } catch (error) {
        if (!cancelled) {
          const fallback = parsePerformanceCsvToRecords(SAMPLE_PERFORMANCE_TSV);
          setPerformanceRecords(fallback);
          setPerformanceLoadState({
            status: "error",
            source: "sample",
            message:
              error instanceof Error
                ? `Nguon ads loi: ${error.message}`
                : "Nguon ads khong tai duoc",
          });
        }
      }
    }

    loadPerformanceData();

    return () => {
      cancelled = true;
    };
  }, [activePerformanceSheetUrl, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    const sheetUrl = activePhoneSheetUrl.trim();

    async function loadPhoneData() {
      setPhoneLoadState({
        status: "loading",
        source: sheetUrl ? "sheet" : "sample",
        message: sheetUrl
          ? "Dang tai nguon danh sach SDT"
          : "Dang dung mau nguon danh sach SDT",
      });

      try {
        const csv = sheetUrl
          ? await fetchCsv(resolveGoogleSheetCsvUrl(sheetUrl))
          : SAMPLE_PHONE_TSV;
        const parsedRecords = parsePhoneCsvToRecords(csv);

        if (!cancelled) {
          setPhoneRecords(parsedRecords);
          setPhoneLoadState({
            status: "ready",
            source: sheetUrl ? "sheet" : "sample",
            message: sheetUrl
              ? `Nguon SDT: ${numberFormatter.format(parsedRecords.length)} dong`
              : "Nguon SDT dang dung du lieu mau",
          });
        }
      } catch (error) {
        if (!cancelled) {
          const fallback = parsePhoneCsvToRecords(SAMPLE_PHONE_TSV);
          setPhoneRecords(fallback);
          setPhoneLoadState({
            status: "error",
            source: "sample",
            message:
              error instanceof Error
                ? `Nguon SDT loi: ${error.message}`
                : "Nguon SDT khong tai duoc",
          });
        }
      }
    }

    loadPhoneData();

    return () => {
      cancelled = true;
    };
  }, [activePhoneSheetUrl, refreshTick]);

  const filterOptions = useMemo(
    () => ({
      pages: uniqueSorted([
        ...performanceRecords.map((record) => record.page),
        ...phoneRecords.map((record) => record.page),
      ]),
      adAccounts: uniqueSorted([
        ...performanceRecords.map((record) => record.adAccount),
        ...phoneRecords.map((record) => record.adAccount),
      ]),
      services: uniqueSorted([
        ...performanceRecords.map((record) => record.service),
        ...phoneRecords.map((record) => record.service),
      ]),
      genders: uniqueSorted(phoneRecords.map((record) => record.gender)),
      adIds: uniqueSorted([
        ...performanceRecords.map((record) => record.adId),
        ...phoneRecords.map((record) => record.adId),
      ]),
    }),
    [performanceRecords, phoneRecords],
  );

  const filteredPerformanceRecords = useMemo(
    () =>
      performanceRecords.filter((record) =>
        matchesPerformanceFilters(record, filters),
      ),
    [performanceRecords, filters],
  );

  const filteredPhoneRecords = useMemo(
    () => phoneRecords.filter((record) => matchesPhoneFilters(record, filters)),
    [phoneRecords, filters],
  );

  const summary = useMemo(
    () => summarizeRecords(filteredPerformanceRecords, filteredPhoneRecords),
    [filteredPerformanceRecords, filteredPhoneRecords],
  );

  const trendData = useMemo(
    () => buildTrendData(filteredPerformanceRecords),
    [filteredPerformanceRecords],
  );

  const groupedData = useMemo(
    () => buildGroupedData(filteredPerformanceRecords, dimension),
    [filteredPerformanceRecords, dimension],
  );

  const genderData = useMemo(
    () => buildGenderData(filteredPhoneRecords),
    [filteredPhoneRecords],
  );

  const topAdsData = useMemo(
    () => buildGroupedData(filteredPerformanceRecords, "adId", 10, topMetric),
    [filteredPerformanceRecords, topMetric],
  );

  const performanceRows = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);
    const rows = buildPerformanceRows(filteredPerformanceRecords);
    const searchedRows = normalizedSearch
      ? rows.filter((row) =>
          normalizeSearch(performanceRowToSearchText(row)).includes(
            normalizedSearch,
          ),
        )
      : rows;

    return [...searchedRows].sort((a, b) =>
      compareTableRows(
        a,
        b,
        performanceSortKey,
        performanceSortDirection,
      ),
    );
  }, [
    filteredPerformanceRecords,
    performanceSortDirection,
    performanceSortKey,
    searchTerm,
  ]);

  useEffect(() => {
    setPerformancePage(1);
  }, [filters, searchTerm, performancePageSize]);

  const phoneRows = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);
    const rows = buildPhoneRows(filteredPhoneRecords);
    const searchedRows = normalizedSearch
      ? rows.filter((row) =>
          normalizeSearch(phoneRowToSearchText(row)).includes(normalizedSearch),
        )
      : rows;

    return [...searchedRows].sort((a, b) =>
      compareTableRows(a, b, phoneSortKey, phoneSortDirection),
    );
  }, [filteredPhoneRecords, phoneSortDirection, phoneSortKey, searchTerm]);

  useEffect(() => {
    setPhonePage(1);
  }, [filters, searchTerm, phonePageSize]);

  const performancePagination = useMemo(
    () => paginateRows(performanceRows, performancePage, performancePageSize),
    [performanceRows, performancePage, performancePageSize],
  );

  const phonePagination = useMemo(
    () => paginateRows(phoneRows, phonePage, phonePageSize),
    [phoneRows, phonePage, phonePageSize],
  );

  const currentAccount = useMemo(
    () => accounts.find((account) => account.id === currentAccountId) ?? null,
    [accounts, currentAccountId],
  );

  const isAdminAccount = currentAccount?.role === "admin";

  const currentAccountState = currentAccount
    ? getAccountState(currentAccount)
    : null;

  useEffect(() => {
    if (!firebaseServices || !firebaseUser || currentAccount?.role !== "admin") {
      return;
    }

    return onSnapshot(
      collection(firebaseServices.db, FIRESTORE_ACCOUNTS_COLLECTION),
      (snapshot) => {
        const syncedAccounts = snapshot.docs.map((accountDoc) =>
          accountFromFirestoreDoc(accountDoc.id, accountDoc.data()),
        );
        setAccounts(syncedAccounts);
        setIsAccountSyncReady(true);
      },
      (error) => {
        setAccountMessage(firebaseErrorToMessage(error));
      },
    );
  }, [currentAccount?.role, firebaseUser]);

  const pendingEmailAccounts = useMemo(
    () =>
      accounts.filter((account) => getAccountState(account) === "pending_email"),
    [accounts],
  );

  const pendingAdminAccounts = useMemo(
    () =>
      accounts.filter((account) => getAccountState(account) === "pending_admin"),
    [accounts],
  );

  const activeAccounts = useMemo(
    () => accounts.filter((account) => getAccountState(account) === "active"),
    [accounts],
  );

  const expiredAccounts = useMemo(
    () => accounts.filter((account) => getAccountState(account) === "expired"),
    [accounts],
  );

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const isAuthLoading =
    isFirebaseEnabled && (!isAuthReady || (Boolean(firebaseUser) && !isAccountSyncReady));

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearchTerm("");
  }

  function applySheetUrls() {
    const nextPerformanceUrl = performanceSheetUrlInput.trim();
    const nextPhoneUrl = phoneSheetUrlInput.trim();
    const resolvedPerformanceUrl = nextPerformanceUrl || PERFORMANCE_CSV_URL;
    const resolvedPhoneUrl = nextPhoneUrl || PHONE_CSV_URL;

    if (typeof window !== "undefined") {
      if (nextPerformanceUrl) {
        window.localStorage.setItem(
          PERFORMANCE_SHEET_URL_STORAGE_KEY,
          nextPerformanceUrl,
        );
      } else {
        window.localStorage.removeItem(PERFORMANCE_SHEET_URL_STORAGE_KEY);
      }

      if (nextPhoneUrl) {
        window.localStorage.setItem(PHONE_SHEET_URL_STORAGE_KEY, nextPhoneUrl);
      } else {
        window.localStorage.removeItem(PHONE_SHEET_URL_STORAGE_KEY);
      }
    }

    setPerformanceSheetUrlInput(resolvedPerformanceUrl);
    setPhoneSheetUrlInput(resolvedPhoneUrl);
    setActivePerformanceSheetUrl(resolvedPerformanceUrl);
    setActivePhoneSheetUrl(resolvedPhoneUrl);
    setRefreshTick((current) => current + 1);
  }

  function handleSheetUrlKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      applySheetUrls();
    }
  }

  function downloadPerformanceTemplate() {
    downloadText(PERFORMANCE_TEMPLATE_FILENAME, SAMPLE_PERFORMANCE_TSV);
  }

  function downloadPhoneTemplate() {
    downloadText(PHONE_TEMPLATE_FILENAME, SAMPLE_PHONE_TSV);
  }

  async function loginAccount() {
    const email = normalizeEmail(authForm.email);
    const password = authForm.password;
    const account = accounts.find(
      (item) => normalizeEmail(item.email) === email,
    );

    if (!email || !password) {
      setAuthMessage("Vui lòng nhập Gmail và mật khẩu.");
      return;
    }

    if (firebaseServices) {
      try {
        setAuthMessage("Dang dang nhap...");
        await signInWithEmailAndPassword(firebaseServices.auth, email, password);
        setAuthForm(DEFAULT_AUTH_FORM);
        setAuthMessage("");
        setAccountMessage("");
      } catch (error) {
        setAuthMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    if (!account || account.password !== password) {
      setAuthMessage("Tài khoản hoặc mật khẩu không đúng.");
      return;
    }

    saveCurrentAccountId(account.id);
    setCurrentAccountId(account.id);
    setAuthForm(DEFAULT_AUTH_FORM);
    setAuthMessage("");
    setAccountMessage("");
  }

  async function registerAccount() {
    const email = normalizeEmail(authForm.email);
    const password = authForm.password.trim();
    const displayName = authForm.displayName.trim() || email;

    if (!email || !password) {
      setAuthMessage("Vui lòng nhập Gmail và mật khẩu.");
      return;
    }

    if (!isGmailAddress(email)) {
      setAuthMessage("Vui lòng đăng ký bằng địa chỉ Gmail.");
      return;
    }

    if (password.length < (firebaseServices ? 6 : 4)) {
      if (firebaseServices) {
        setAuthMessage("Mat khau nen co it nhat 6 ky tu.");
        return;
      }
      setAuthMessage("Mật khẩu nên có ít nhất 4 ký tự.");
      return;
    }

    if (firebaseServices) {
      try {
        setAuthMessage("Dang tao tai khoan Firebase...");
        const credential = await createUserWithEmailAndPassword(
          firebaseServices.auth,
          email,
          password,
        );
        await updateProfile(credential.user, { displayName });
        await createOrUpdateFirebaseAccountProfile(
          credential.user,
          displayName,
        );
        await sendEmailVerification(credential.user);
        setAuthForm({ ...DEFAULT_AUTH_FORM, email });
        setAuthMessage("");
        setAccountMessage(
          "Da tao tai khoan va gui email xac thuc. Hay mo Gmail, bam link xac thuc roi quay lai app.",
        );
      } catch (error) {
        setAuthMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    if (
      accounts.some((account) => normalizeEmail(account.email) === email)
    ) {
      setAuthMessage("Tài khoản này đã tồn tại.");
      return;
    }

    const verificationCode = createVerificationCode();
    const account: AccountRecord = {
      id: createId(),
      email,
      password,
      displayName,
      role: "user",
      createdAt: new Date().toISOString(),
      verificationCode,
    };

    setAccounts((current) => [...current, account]);
    saveCurrentAccountId(account.id);
    setCurrentAccountId(account.id);
    setAuthForm({ ...DEFAULT_AUTH_FORM, email });
    setAuthMessage("");
    setAccountMessage(
      `Tài khoản đã tạo. Mã xác thực demo của Gmail này là ${verificationCode}.`,
    );
  }

  async function requestPasswordReset() {
    const email = normalizeEmail(authForm.email);
    const account = accounts.find(
      (item) => normalizeEmail(item.email) === email,
    );

    if (!email) {
      setAuthMessage("Vui lòng nhập Gmail cần lấy lại mật khẩu.");
      return;
    }

    if (firebaseServices) {
      try {
        await sendPasswordResetEmail(firebaseServices.auth, email);
        setAuthForm({ ...DEFAULT_AUTH_FORM, email });
        setAuthMode("login");
        setAuthMessage(
          "Da gui email dat lai mat khau. Hay mo Gmail va lam theo huong dan.",
        );
      } catch (error) {
        setAuthMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    if (!account) {
      setAuthMessage("Không tìm thấy tài khoản với Gmail này.");
      return;
    }

    const resetCode = createVerificationCode();
    setAccounts((current) =>
      current.map((item) =>
        item.id === account.id
          ? {
              ...item,
              passwordResetCode: resetCode,
              passwordResetRequestedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    setAuthForm({ ...DEFAULT_AUTH_FORM, email });
    setAuthMode("reset");
    setAuthMessage(`Mã đặt lại mật khẩu demo là ${resetCode}.`);
  }

  function resetPassword() {
    const email = normalizeEmail(authForm.email);
    const resetCode = authForm.resetCode.trim();
    const password = authForm.password.trim();
    const account = accounts.find(
      (item) => normalizeEmail(item.email) === email,
    );

    if (!email || !resetCode || !password) {
      setAuthMessage("Vui lòng nhập Gmail, mã đặt lại và mật khẩu mới.");
      return;
    }

    if (password.length < 4) {
      setAuthMessage("Mật khẩu mới nên có ít nhất 4 ký tự.");
      return;
    }

    if (!account || account.passwordResetCode !== resetCode) {
      setAuthMessage("Gmail hoặc mã đặt lại không đúng.");
      return;
    }

    setAccounts((current) =>
      current.map((item) =>
        item.id === account.id
          ? {
              ...item,
              password,
              passwordResetCode: undefined,
              passwordResetRequestedAt: undefined,
            }
          : item,
      ),
    );
    setAuthForm({ ...DEFAULT_AUTH_FORM, email });
    setAuthMode("login");
    setAuthMessage("Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.");
  }

  async function logoutAccount() {
    if (firebaseServices) {
      await signOut(firebaseServices.auth);
      setFirebaseUser(null);
      setCurrentAccountId("");
      setAccounts([]);
      setAuthForm(DEFAULT_AUTH_FORM);
      setAccountMessage("Da dang xuat tai khoan.");
      return;
    }

    saveCurrentAccountId("");
    setCurrentAccountId("");
    setAuthForm(DEFAULT_AUTH_FORM);
    setAccountMessage("Đã đăng xuất tài khoản.");
  }

  async function verifyCurrentAccountEmail() {
    if (!currentAccount) return;

    if (firebaseServices && firebaseUser) {
      try {
        await reload(firebaseUser);
        if (!firebaseUser.emailVerified) {
          setAccountMessage(
            "Chua thay Gmail duoc xac thuc. Hay bam link trong email roi thu lai.",
          );
          return;
        }

        await updateDoc(
          doc(
            firebaseServices.db,
            FIRESTORE_ACCOUNTS_COLLECTION,
            firebaseUser.uid,
          ),
          {
            emailVerifiedAt: new Date().toISOString(),
          },
        );
        setAccountMessage(
          "Gmail da xac thuc. Vui long lien he admin de kich hoat tai khoan.",
        );
      } catch (error) {
        setAccountMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    const code = authForm.verificationCode.trim();

    if (!code) {
      setAccountMessage("Vui lòng nhập mã xác thực Gmail.");
      return;
    }

    if (code !== currentAccount.verificationCode) {
      setAccountMessage("Mã xác thực không đúng.");
      return;
    }

    const verifiedAccount: AccountRecord = {
      ...currentAccount,
      emailVerifiedAt: new Date().toISOString(),
    };

    setAccounts((current) =>
      current.map((account) =>
        account.id === currentAccount.id ? verifiedAccount : account,
      ),
    );
    setAuthForm(DEFAULT_AUTH_FORM);
    setAccountMessage(
      "Gmail đã xác thực. Vui lòng liên hệ admin để kích hoạt tài khoản.",
    );
  }

  async function resendVerificationEmail() {
    if (firebaseServices && firebaseUser) {
      try {
        await sendEmailVerification(firebaseUser);
        setAccountMessage("Da gui lai email xac thuc Gmail.");
      } catch (error) {
        setAccountMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    if (currentAccount?.verificationCode) {
      setAccountMessage(
        `Ma xac thuc demo cua Gmail nay la ${currentAccount.verificationCode}.`,
      );
    }
  }

  async function activateOrExtendAccount(accountId: string) {
    const days = clampInteger(adminDurationDays, 1, 3650);
    const now = new Date();
    const targetAccount = accounts.find((account) => account.id === accountId);

    if (firebaseServices) {
      if (!targetAccount || targetAccount.role === "admin") return;
      if (!targetAccount.emailVerifiedAt) {
        setAccountMessage("Tai khoan can xac thuc Gmail truoc khi kich hoat.");
        return;
      }

      const currentExpiry = targetAccount.expiresAt
        ? new Date(targetAccount.expiresAt)
        : now;
      const baseDate =
        currentExpiry.getTime() > now.getTime() ? currentExpiry : now;

      try {
        await updateDoc(
          doc(firebaseServices.db, FIRESTORE_ACCOUNTS_COLLECTION, accountId),
          {
            activatedAt: targetAccount.activatedAt ?? now.toISOString(),
            expiresAt: addDays(baseDate, days).toISOString(),
          },
        );
        setAccountMessage(`Da kich hoat/gia han ${formatNumber(days)} ngay.`);
      } catch (error) {
        setAccountMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    setAccounts((current) =>
      current.map((account) => {
        if (account.id !== accountId || account.role === "admin") return account;

        if (!account.emailVerifiedAt) {
          setAccountMessage("Tài khoản cần xác thực Gmail trước khi kích hoạt.");
          return account;
        }

        const currentExpiry = account.expiresAt
          ? new Date(account.expiresAt)
          : now;
        const baseDate =
          currentExpiry.getTime() > now.getTime() ? currentExpiry : now;

        return {
          ...account,
          activatedAt: account.activatedAt ?? now.toISOString(),
          expiresAt: addDays(baseDate, days).toISOString(),
        };
      }),
    );
    setAccountMessage(`Đã kích hoạt/gia hạn ${formatNumber(days)} ngày.`);
  }

  async function expireAccount(accountId: string) {
    const confirmed = window.confirm("Dừng quyền truy cập của tài khoản này?");
    if (!confirmed) return;

    if (firebaseServices) {
      try {
        await updateDoc(
          doc(firebaseServices.db, FIRESTORE_ACCOUNTS_COLLECTION, accountId),
          {
            expiresAt: new Date().toISOString(),
          },
        );
      } catch (error) {
        setAccountMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    setAccounts((current) =>
      current.map((account) =>
        account.id === accountId
          ? { ...account, expiresAt: new Date().toISOString() }
          : account,
      ),
    );
  }

  async function removeAccount(accountId: string) {
    const account = accounts.find((item) => item.id === accountId);
    if (!account || account.role === "admin") return;
    const confirmed = window.confirm(`Xóa tài khoản ${account.email}?`);
    if (!confirmed) return;

    if (firebaseServices) {
      try {
        await deleteDoc(
          doc(firebaseServices.db, FIRESTORE_ACCOUNTS_COLLECTION, accountId),
        );
      } catch (error) {
        setAccountMessage(firebaseErrorToMessage(error));
      }
      return;
    }

    setAccounts((current) => current.filter((item) => item.id !== accountId));
    if (currentAccountId === accountId) {
      logoutAccount();
    }
  }

  function exportAccounts() {
    const csv = Papa.unparse(
      accounts.map((account) => ({
        email: account.email,
        displayName: account.displayName,
        role: account.role,
        status: getAccountStateLabel(getAccountState(account)),
        createdAt: formatDateTime(account.createdAt),
        emailVerifiedAt: formatDateTime(account.emailVerifiedAt),
        activatedAt: formatDateTime(account.activatedAt),
        expiresAt: formatDateTime(account.expiresAt),
        daysLeft: getAccountDaysLeft(account),
        note: account.note ?? "",
      })),
    );
    downloadCsv(`accounts-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  function handlePerformanceSort(key: PerformanceSortKey) {
    if (performanceSortKey === key) {
      setPerformanceSortDirection((current) =>
        current === "asc" ? "desc" : "asc",
      );
      return;
    }

    setPerformanceSortKey(key);
    setPerformanceSortDirection(
      ["spend", "messages", "comments", "phoneCount"].includes(key)
        ? "desc"
        : "asc",
    );
  }

  function handlePhoneSort(key: PhoneSortKey) {
    if (phoneSortKey === key) {
      setPhoneSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setPhoneSortKey(key);
    setPhoneSortDirection("asc");
  }

  function exportPerformanceRows() {
    const csv = Papa.unparse(
      performanceRows.map((row) => ({
        adId: row.adId,
        page: row.page,
        service: row.service,
        adAccount: row.adAccount,
        spend: row.spend,
        messages: row.messages,
        comments: row.comments,
        phoneCount: row.phoneCount,
      })),
    );
    downloadCsv(
      `ads-performance-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  }

  function exportPhoneRows() {
    const csv = Papa.unparse(
      phoneRows.map((row) => ({
        phoneList: row.phoneList,
        adId: row.adId,
        adAccount: row.adAccount,
        page: row.page,
        service: row.service,
      })),
    );
    downloadCsv(
      `ads-phone-list-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Google Sheet Ads</p>
          <h1>Dashboard hiệu quả quảng cáo</h1>
        </div>
        <div className="topbar-actions">
          {currentAccount && (
            <span
              className={`status-pill ${
                isAdminAccount ? "status-ready" : "status-loading"
              }`}
            >
              <ShieldCheck size={16} />
              {currentAccount.email}
              {isAdminAccount ? " / admin" : ""}
            </span>
          )}
          {!isAdminAccount && currentAccount && currentAccountState === "active" && (
            <span className="status-pill status-ready">
              <ShieldCheck size={16} />
              Còn {getAccountDaysLeft(currentAccount)} ngày
            </span>
          )}
          <span className={`status-pill status-${performanceLoadState.status}`}>
            {performanceLoadState.message}
          </span>
          <span className={`status-pill status-${phoneLoadState.status}`}>
            {phoneLoadState.message}
          </span>
          {isAdminAccount && (
            <button
              className="icon-button"
              type="button"
              title="Quản lý tài khoản"
              onClick={() => setIsAccountManagerOpen((current) => !current)}
            >
              <UserCog size={18} />
              <span>Quản lý tài khoản</span>
            </button>
          )}
          <button
            className="icon-button"
            type="button"
            title="Tải lại dữ liệu"
            onClick={() => setRefreshTick((current) => current + 1)}
          >
            <RefreshCw size={18} />
            <span>Cập nhật</span>
          </button>
          {currentAccount && (
            <button
              className="ghost-button"
              type="button"
              title="Đăng xuất tài khoản"
              onClick={logoutAccount}
            >
              <LogOut size={17} />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </header>

      {isAdminAccount && isAccountManagerOpen && (
        <AccountManager
          accountMessage={accountMessage}
          adminDurationDays={adminDurationDays}
          pendingEmailAccounts={pendingEmailAccounts}
          pendingAdminAccounts={pendingAdminAccounts}
          activeAccounts={activeAccounts}
          expiredAccounts={expiredAccounts}
          setAdminDurationDays={setAdminDurationDays}
          activateOrExtendAccount={activateOrExtendAccount}
          expireAccount={expireAccount}
          removeAccount={removeAccount}
          exportAccounts={exportAccounts}
        />
      )}

      {isAuthLoading ? (
        <AuthLoadingGate />
      ) : !currentAccount ? (
        <AuthGate
          authForm={authForm}
          authMessage={authMessage}
          authMode={authMode}
          isFirebaseMode={isFirebaseEnabled}
          setAuthForm={setAuthForm}
          setAuthMode={setAuthMode}
          loginAccount={loginAccount}
          registerAccount={registerAccount}
          requestPasswordReset={requestPasswordReset}
          resetPassword={resetPassword}
        />
      ) : !isAdminAccount && currentAccountState === "pending_email" ? (
        <EmailVerificationGate
          currentAccount={currentAccount}
          authForm={authForm}
          accountMessage={accountMessage}
          setAuthForm={setAuthForm}
          verifyCurrentAccountEmail={verifyCurrentAccountEmail}
          resendVerificationEmail={resendVerificationEmail}
          isFirebaseMode={isFirebaseEnabled}
        />
      ) : !isAdminAccount && currentAccountState !== "active" ? (
        <PendingActivationGate
          currentAccount={currentAccount}
          accountState={currentAccountState}
          accountMessage={accountMessage}
        />
      ) : (
        <>
      <section className="source-config" aria-label="Cấu hình nguồn dữ liệu">
        <label className="sheet-url-field">
          Link nguồn hiệu quả ads
          <input
            type="url"
            value={performanceSheetUrlInput}
            onChange={(event) =>
              setPerformanceSheetUrlInput(event.target.value)
            }
            onKeyDown={handleSheetUrlKeyDown}
            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
          />
        </label>
        <label className="sheet-url-field">
          Link nguồn danh sách SĐT
          <input
            type="url"
            value={phoneSheetUrlInput}
            onChange={(event) => setPhoneSheetUrlInput(event.target.value)}
            onKeyDown={handleSheetUrlKeyDown}
            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
          />
        </label>
        <button
          className="icon-button"
          type="button"
          title="Áp dụng link Google Sheet"
          onClick={applySheetUrls}
        >
          <LinkIcon size={17} />
          <span>Áp dụng link</span>
        </button>
        <button
          className="ghost-button"
          type="button"
          title="Tải mẫu nguồn hiệu quả ads"
          onClick={downloadPerformanceTemplate}
        >
          <FileDown size={17} />
          <span>Mẫu ads</span>
        </button>
        <button
          className="ghost-button"
          type="button"
          title="Tải mẫu nguồn danh sách SĐT"
          onClick={downloadPhoneTemplate}
        >
          <FileDown size={17} />
          <span>Mẫu SĐT</span>
        </button>
      </section>

      <section className="filter-bar" aria-label="Bộ lọc dashboard">
        <div className="filter-title">
          <SlidersHorizontal size={18} />
          <span>Bộ lọc</span>
        </div>
        <label>
          Từ ngày
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => updateFilter("startDate", event.target.value)}
          />
        </label>
        <label>
          Đến ngày
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => updateFilter("endDate", event.target.value)}
          />
        </label>
        <SelectFilter
          label="Page"
          value={filters.page}
          options={filterOptions.pages}
          onChange={(value) => updateFilter("page", value)}
        />
        <SelectFilter
          label="Tài khoản"
          value={filters.adAccount}
          options={filterOptions.adAccounts}
          onChange={(value) => updateFilter("adAccount", value)}
        />
        <SelectFilter
          label="Dịch vụ"
          value={filters.service}
          options={filterOptions.services}
          onChange={(value) => updateFilter("service", value)}
        />
        <SelectFilter
          label="Giới tính"
          value={filters.gender}
          options={filterOptions.genders}
          onChange={(value) => updateFilter("gender", value)}
        />
        <SelectFilter
          label="Ad ID"
          value={filters.adId}
          options={filterOptions.adIds}
          onChange={(value) => updateFilter("adId", value)}
        />
        <button
          className="ghost-button"
          type="button"
          title="Xóa bộ lọc"
          onClick={clearFilters}
          disabled={!hasActiveFilters && !searchTerm}
        >
          <FilterX size={17} />
          <span>Xóa lọc</span>
        </button>
      </section>

      {performanceLoadState.status === "error" && (
        <div className="error-banner" role="alert">
          {performanceLoadState.message}. Nguon ads dang hien thi du lieu mau.
        </div>
      )}

      {phoneLoadState.status === "error" && (
        <div className="error-banner" role="alert">
          {phoneLoadState.message}. Nguon SDT dang hien thi du lieu mau.
        </div>
      )}

      <main>
        <section className="kpi-grid" aria-label="Chỉ số tổng quan">
          <KpiCard label="Tổng chi tiêu" value={formatMoney(summary.spend)} />
          <KpiCard label="Tổng mess" value={formatNumber(summary.messages)} />
          <KpiCard label="Bình luận" value={formatNumber(summary.comments)} />
          <KpiCard
            label="SĐT/Mess"
            value={formatPercent(summary.phonePerMessage)}
          />
          <KpiCard
            label="SĐT hợp lệ"
            value={formatNumber(summary.validPhones)}
          />
          <KpiCard
            label="SĐT duy nhất"
            value={formatNumber(summary.uniquePhones)}
          />
          <KpiCard
            label="Chi phí/mess"
            value={formatMoney(summary.costPerMessage)}
          />
          <KpiCard
            label="Chi phí/lead"
            value={formatMoney(summary.costPerLead)}
          />
        </section>

        <section className="chart-grid" aria-label="Biểu đồ thống kê">
          <ChartPanel
            title="Xu hướng theo ngày"
            subtitle={`${formatNumber(filteredPerformanceRecords.length)} dong nguon ads sau loc`}
          >
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={trendData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" minTickGap={22} />
                <YAxis
                  yAxisId="money"
                  tickFormatter={(value) => compactFormatter.format(Number(value))}
                />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  tickFormatter={(value) => compactFormatter.format(Number(value))}
                />
                <Tooltip
                  formatter={(value, name) =>
                    formatTooltipValue(Number(value), String(name))
                  }
                />
                <Legend />
                <Bar
                  yAxisId="money"
                  dataKey="spend"
                  name="Chi tiêu"
                  fill={CHART_COLORS.spend}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="messages"
                  name="Mess"
                  stroke={CHART_COLORS.messages}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="count"
                  type="monotone"
                  dataKey="leads"
                  name="Lead"
                  stroke={CHART_COLORS.leads}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="So sánh nhóm"
            action={
              <SegmentedControl
                value={dimension}
                options={[
                  { value: "page", label: "Page" },
                  { value: "adAccount", label: "Tài khoản" },
                  { value: "service", label: "Dịch vụ" },
                ]}
                onChange={(value) => setDimension(value as DimensionKey)}
              />
            }
          >
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={groupedData} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => compactFormatter.format(Number(value))} />
                <Tooltip
                  formatter={(value, name) =>
                    formatTooltipValue(Number(value), String(name))
                  }
                />
                <Legend />
                <Bar
                  dataKey="spend"
                  name="Chi tiêu"
                  fill={CHART_COLORS.spend}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="messages"
                  name="Mess"
                  fill={CHART_COLORS.messages}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="leads"
                  name="Lead"
                  fill={CHART_COLORS.leads}
                  radius={[4, 4, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Phân bổ giới tính">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={104}
                  innerRadius={56}
                  paddingAngle={3}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                >
                  {genderData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={GENDER_COLORS[entry.name] ?? "#0f766e"}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatNumber(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel
            title="Top Ad ID"
            action={
              <SegmentedControl
                value={topMetric}
                options={[
                  { value: "leads", label: "Lead" },
                  { value: "messages", label: "Mess" },
                  { value: "spend", label: "Chi tiêu" },
                ]}
                onChange={(value) => setTopMetric(value as TopMetric)}
              />
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={topAdsData}
                layout="vertical"
                margin={{ top: 12, right: 24, bottom: 8, left: 44 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => compactFormatter.format(Number(value))}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={92}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name) =>
                    formatTooltipValue(Number(value), String(name))
                  }
                />
                <Bar
                  dataKey={topMetric}
                  name={topMetricLabel(topMetric)}
                  fill={CHART_COLORS[topMetric]}
                  radius={[0, 4, 4, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>

        <section className="table-section" aria-label="Bảng tổng hợp quảng cáo">
          <div className="table-toolbar">
            <div>
              <div className="section-heading">
                <Table2 size={18} />
                <h2>Bảng 1: Tổng hợp quảng cáo</h2>
              </div>
              <p>
                {formatNumber(performanceRows.length)} nhóm từ{" "}
                {formatNumber(filteredPerformanceRecords.length)} dong nguon ads sau loc
              </p>
            </div>
            <div className="table-actions">
              <label className="search-box">
                <Search size={17} />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm page, dịch vụ, ad id, SĐT..."
                />
              </label>
              <button
                className="icon-button"
                type="button"
                title="Xuất bảng 1"
                onClick={exportPerformanceRows}
                disabled={performanceRows.length === 0}
              >
                <Download size={17} />
                <span>Xuất bảng 1</span>
              </button>
            </div>
          </div>

          <div
            className={`table-scroll ${
              performancePagination.isScrollable ? "table-scroll-paged" : ""
            }`}
          >
            <table>
              <thead>
                <tr>
                  {PERFORMANCE_TABLE_COLUMNS.map((column) => (
                    <th key={column.key} className={column.align ?? ""}>
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => handlePerformanceSort(column.key)}
                      >
                        <span>{column.label}</span>
                        {performanceSortKey === column.key ? (
                          performanceSortDirection === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          )
                        ) : (
                          <ArrowUpDown size={14} />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {performanceRows.length > 0 ? (
                  performancePagination.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.adId}</td>
                      <td>{row.page}</td>
                      <td>{row.service}</td>
                      <td>{row.adAccount}</td>
                      <td className="right">{formatMoney(row.spend)}</td>
                      <td className="right">{formatNumber(row.messages)}</td>
                      <td className="right">{formatNumber(row.comments)}</td>
                      <td className="right">{formatNumber(row.phoneCount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="empty-cell"
                      colSpan={PERFORMANCE_TABLE_COLUMNS.length}
                    >
                      Không có dòng phù hợp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {performanceRows.length > 0 && (
            <PaginationControls
              label="Bảng 1"
              pagination={performancePagination}
              pageSize={performancePageSize}
              onPageChange={setPerformancePage}
              onPageSizeChange={setPerformancePageSize}
            />
          )}
        </section>

        <section className="table-section" aria-label="Bảng danh sách số điện thoại">
          <div className="table-toolbar">
            <div>
              <div className="section-heading">
                <Table2 size={18} />
                <h2>Bảng 2: Danh sách số điện thoại</h2>
              </div>
              <p>{formatNumber(phoneRows.length)} nhóm có SĐT</p>
            </div>
            <div className="table-actions">
              <button
                className="icon-button"
                type="button"
                title="Xuất bảng 2"
                onClick={exportPhoneRows}
                disabled={phoneRows.length === 0}
              >
                <Download size={17} />
                <span>Xuất bảng 2</span>
              </button>
            </div>
          </div>

          <div
            className={`table-scroll ${
              phonePagination.isScrollable ? "table-scroll-paged" : ""
            }`}
          >
            <table className="phone-table">
              <thead>
                <tr>
                  {PHONE_TABLE_COLUMNS.map((column) => (
                    <th key={column.key} className={column.align ?? ""}>
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => handlePhoneSort(column.key)}
                      >
                        <span>{column.label}</span>
                        {phoneSortKey === column.key ? (
                          phoneSortDirection === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          )
                        ) : (
                          <ArrowUpDown size={14} />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phoneRows.length > 0 ? (
                  phonePagination.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="phone-list-cell">{row.phoneList}</td>
                      <td>{row.adId}</td>
                      <td>{row.adAccount}</td>
                      <td>{row.page}</td>
                      <td>{row.service}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="empty-cell" colSpan={PHONE_TABLE_COLUMNS.length}>
                      Không có số điện thoại phù hợp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {phoneRows.length > 0 && (
            <PaginationControls
              label="Bảng 2"
              pagination={phonePagination}
              pageSize={phonePageSize}
              onPageChange={setPhonePage}
              onPageSizeChange={setPhonePageSize}
            />
          )}
        </section>
      </main>
        </>
      )}
    </div>
  );
}

const CHART_MARGIN = { top: 12, right: 24, bottom: 8, left: 8 };

interface PaginationState<T> {
  rows: T[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  isScrollable: boolean;
}

function AuthLoadingGate() {
  return (
    <main className="license-main">
      <section className="license-gate">
        <div className="license-gate-copy">
          <p className="eyebrow">Dang dong bo</p>
          <h2>Dang tai tai khoan</h2>
          <p>App dang ket noi Firebase va dong bo trang thai kich hoat.</p>
        </div>
        <div className="license-card">
          <div className="license-icon">
            <RefreshCw size={28} />
          </div>
          <p className="license-message">Vui long cho trong giay lat.</p>
        </div>
      </section>
    </main>
  );
}

function PaginationControls<T>({
  label,
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  label: string;
  pagination: PaginationState<T>;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  return (
    <div className="table-pagination" aria-label={`Phân trang ${label}`}>
      <p>
        Hiển thị {formatNumber(pagination.start)}-{formatNumber(pagination.end)} /{" "}
        {formatNumber(pagination.total)} dòng
      </p>
      <div className="pagination-actions">
        <label className="page-size-field">
          Dòng/trang
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          className="mini-icon-button"
          type="button"
          title="Trang trước"
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="page-counter">
          Trang {formatNumber(pagination.page)} / {formatNumber(pagination.pageCount)}
        </span>
        <button
          className="mini-icon-button"
          type="button"
          title="Trang sau"
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.pageCount}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function AuthGate({
  authForm,
  authMessage,
  authMode,
  isFirebaseMode,
  setAuthForm,
  setAuthMode,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  resetPassword,
}: {
  authForm: AuthFormState;
  authMessage: string;
  authMode: AuthMode;
  isFirebaseMode: boolean;
  setAuthForm: (value: AuthFormState) => void;
  setAuthMode: (value: AuthMode) => void;
  loginAccount: () => void | Promise<void>;
  registerAccount: () => void | Promise<void>;
  requestPasswordReset: () => void | Promise<void>;
  resetPassword: () => void | Promise<void>;
}) {
  const isRegister = authMode === "register";
  const isForgot = authMode === "forgot";
  const isReset = authMode === "reset";
  const title = isForgot
    ? "Lấy lại mật khẩu bằng Gmail"
    : isReset
      ? "Đặt lại mật khẩu"
      : isRegister
        ? "Đăng ký Gmail để chờ admin kích hoạt"
        : "Tài khoản được admin kích hoạt theo thời hạn";
  const primaryLabel = isForgot
    ? "Gửi mã đặt lại"
    : isReset
      ? "Đặt lại mật khẩu"
      : isRegister
        ? "Đăng ký Gmail"
        : "Đăng nhập";
  const primaryAction = isForgot
    ? requestPasswordReset
    : isReset
      ? resetPassword
      : isRegister
        ? registerAccount
        : loginAccount;
  const resolvedPrimaryLabel =
    isForgot && isFirebaseMode ? "Gui email dat lai" : primaryLabel;

  function updateForm<K extends keyof AuthFormState>(
    key: K,
    value: AuthFormState[K],
  ) {
    setAuthForm({ ...authForm, [key]: value });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      primaryAction();
    }
  }

  return (
    <main className="license-main">
      <section className="license-gate">
        <div className="license-gate-copy">
          <p className="eyebrow">Đăng nhập tài khoản</p>
          <h2>{title}</h2>
          <p>
            Khách đăng ký bằng Gmail, xác thực Gmail, rồi liên hệ admin để được
            kích hoạt hoặc gia hạn quyền dùng dashboard.
          </p>
        </div>
        <div className="license-card">
          <div className="license-icon">
            <Lock size={28} />
          </div>
          {isRegister && (
            <label>
              Tên hiển thị
              <input
                type="text"
                value={authForm.displayName}
                onChange={(event) => updateForm("displayName", event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="VD: Khách A"
              />
            </label>
          )}
          <label>
            Gmail
            <input
              type="email"
              value={authForm.email}
              onChange={(event) => updateForm("email", event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="tenkhach@gmail.com"
            />
          </label>
          {(isReset || !isForgot) && (
            <label>
              {isReset ? "Mật khẩu mới" : "Mật khẩu"}
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => updateForm("password", event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isReset ? "Nhập mật khẩu mới" : "Nhập mật khẩu"}
              />
            </label>
          )}
          {isReset && (
            <label>
              Mã đặt lại mật khẩu
              <input
                type="text"
                value={authForm.resetCode}
                onChange={(event) => updateForm("resetCode", event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập mã đặt lại"
              />
            </label>
          )}
          <button
            className="icon-button primary-button"
            type="button"
            onClick={primaryAction}
          >
            {isRegister ? <UserPlus size={18} /> : <ShieldCheck size={18} />}
            <span>{resolvedPrimaryLabel}</span>
          </button>
          <div className="auth-link-row">
            <button
              className="text-button"
              type="button"
              onClick={() => setAuthMode(isRegister ? "login" : "register")}
            >
              {isRegister ? "Đã có tài khoản" : "Tạo tài khoản khách"}
            </button>
            {!isForgot && !isReset && (
              <button
                className="text-button"
                type="button"
                onClick={() => setAuthMode("forgot")}
              >
                Quên mật khẩu
              </button>
            )}
            {(isForgot || isReset) && (
              <button
                className="text-button"
                type="button"
                onClick={() => setAuthMode("login")}
              >
                Quay lại đăng nhập
              </button>
            )}
          </div>
          {authMessage && <p className="license-message">{authMessage}</p>}
        </div>
      </section>
    </main>
  );
}

function EmailVerificationGate({
  currentAccount,
  authForm,
  accountMessage,
  setAuthForm,
  verifyCurrentAccountEmail,
  resendVerificationEmail,
  isFirebaseMode,
}: {
  currentAccount: AccountRecord;
  authForm: AuthFormState;
  accountMessage: string;
  setAuthForm: (value: AuthFormState) => void;
  verifyCurrentAccountEmail: () => void | Promise<void>;
  resendVerificationEmail: () => void | Promise<void>;
  isFirebaseMode: boolean;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") verifyCurrentAccountEmail();
  }

  return (
    <main className="license-main">
      <section className="license-gate">
        <div className="license-gate-copy">
          <p className="eyebrow">Xác thực Gmail</p>
          <h2>Xác thực tài khoản trước khi liên hệ admin</h2>
          <p>
            Tài khoản <strong>{currentAccount.email}</strong> cần xác thực Gmail.
            Bản local hiện hiển thị mã demo trong thông báo sau khi đăng ký.
          </p>
        </div>
        <div className="license-card">
          <div className="license-icon">
            <MailCheck size={28} />
          </div>
          {!isFirebaseMode && (
          <label>
            Mã xác thực Gmail
            <input
              type="text"
              value={authForm.verificationCode}
              onChange={(event) =>
                setAuthForm({
                  ...authForm,
                  verificationCode: event.target.value,
                })
              }
              onKeyDown={handleKeyDown}
              placeholder="Nhập mã xác thực"
            />
          </label>
          )}
          <button
            className="icon-button primary-button"
            type="button"
            onClick={verifyCurrentAccountEmail}
          >
            <CheckCircle2 size={18} />
            <span>Xác thực Gmail</span>
          </button>
          {isFirebaseMode && (
            <button
              className="icon-button"
              type="button"
              onClick={resendVerificationEmail}
            >
              <MailCheck size={18} />
              <span>Gui lai email xac thuc</span>
            </button>
          )}
          {accountMessage && <p className="license-message">{accountMessage}</p>}
        </div>
      </section>
    </main>
  );
}

function PendingActivationGate({
  currentAccount,
  accountState,
  accountMessage,
}: {
  currentAccount: AccountRecord;
  accountState: AccountState | null;
  accountMessage: string;
}) {
  const isExpired = accountState === "expired";

  return (
    <main className="license-main">
      <section className="license-gate">
        <div className="license-gate-copy">
          <p className="eyebrow">
            {isExpired ? "Tài khoản hết hạn" : "Chờ admin kích hoạt"}
          </p>
          <h2>
            {isExpired
              ? "Liên hệ admin để gia hạn tài khoản"
              : "Liên hệ admin để mở quyền dashboard"}
          </h2>
          <p>
            Gmail <strong>{currentAccount.email}</strong> đã xác thực. Admin sẽ
            kích hoạt hoặc gia hạn thời gian sử dụng trực tiếp trên tài khoản này.
          </p>
        </div>
        <div className="license-card">
          <div className="license-icon">
            <MessageCircle size={28} />
          </div>
          <ContactAdminPanel />
          {accountMessage && <p className="license-message">{accountMessage}</p>}
        </div>
      </section>
    </main>
  );
}

function ContactAdminPanel() {
  const contacts = buildAdminContacts();

  return (
    <div className="contact-list">
      {contacts.length > 0 ? (
        contacts.map((contact) => (
          <a key={contact.label} href={contact.href} target="_blank" rel="noreferrer">
            {contact.label}
          </a>
        ))
      ) : (
        <p>
          Admin chưa cấu hình thông tin liên hệ. Vui lòng cập nhật số điện thoại,
          Telegram, Zalo hoặc Facebook trong file `.env`.
        </p>
      )}
    </div>
  );
}

function AccountManager({
  accountMessage,
  adminDurationDays,
  pendingEmailAccounts,
  pendingAdminAccounts,
  activeAccounts,
  expiredAccounts,
  setAdminDurationDays,
  activateOrExtendAccount,
  expireAccount,
  removeAccount,
  exportAccounts,
}: {
  accountMessage: string;
  adminDurationDays: number;
  pendingEmailAccounts: AccountRecord[];
  pendingAdminAccounts: AccountRecord[];
  activeAccounts: AccountRecord[];
  expiredAccounts: AccountRecord[];
  setAdminDurationDays: (value: number) => void;
  activateOrExtendAccount: (accountId: string) => void | Promise<void>;
  expireAccount: (accountId: string) => void | Promise<void>;
  removeAccount: (accountId: string) => void | Promise<void>;
  exportAccounts: () => void;
}) {
  const totalAccounts =
    pendingEmailAccounts.length +
    pendingAdminAccounts.length +
    activeAccounts.length +
    expiredAccounts.length;

  return (
    <section className="license-manager" aria-label="Quản lý tài khoản">
      <div className="panel-heading">
        <div>
          <h2>Quản lý tài khoản</h2>
          <p>Kích hoạt, gia hạn và theo dõi thời hạn sử dụng theo từng Gmail.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={exportAccounts}
          disabled={totalAccounts === 0}
        >
          <Download size={17} />
          <span>Xuất tài khoản</span>
        </button>
      </div>

      {accountMessage && <div className="license-notice">{accountMessage}</div>}

      {!isFirebaseEnabled &&
        (ADMIN_EMAIL === "admin@gmail.com" || ADMIN_PASSWORD === "admin123") && (
        <div className="warning-banner">
          Đang dùng tài khoản admin mặc định. Khi đưa app lên online, hãy đặt
          <strong> VITE_ADMIN_EMAIL</strong> và{" "}
          <strong>VITE_ADMIN_PASSWORD</strong> trước khi build.
        </div>
      )}

      <div className="license-stats">
        <div>
          <span>Chờ xác thực Gmail</span>
          <strong>{formatNumber(pendingEmailAccounts.length)}</strong>
        </div>
        <div>
          <span>Chờ kích hoạt</span>
          <strong>{formatNumber(pendingAdminAccounts.length)}</strong>
        </div>
        <div>
          <span>Đang hoạt động</span>
          <strong>{formatNumber(activeAccounts.length)}</strong>
        </div>
        <div>
          <span>Hết hạn</span>
          <strong>{formatNumber(expiredAccounts.length)}</strong>
        </div>
      </div>

      <div className="license-form account-renewal-form">
        <label>
          Số ngày kích hoạt/gia hạn
          <input
            type="number"
            min={1}
            max={3650}
            value={adminDurationDays}
            onChange={(event) =>
              setAdminDurationDays(Number(event.target.value))
            }
          />
        </label>
      </div>

      <AccountTable
        title="Chờ xác thực Gmail"
        rows={pendingEmailAccounts}
        emptyText="Không có tài khoản chờ xác thực"
        activateOrExtendAccount={activateOrExtendAccount}
        expireAccount={expireAccount}
        removeAccount={removeAccount}
      />
      <AccountTable
        title="Chờ admin kích hoạt"
        rows={pendingAdminAccounts}
        emptyText="Không có tài khoản chờ kích hoạt"
        activateOrExtendAccount={activateOrExtendAccount}
        expireAccount={expireAccount}
        removeAccount={removeAccount}
      />
      <AccountTable
        title="Đang hoạt động"
        rows={activeAccounts}
        emptyText="Không có tài khoản đang hoạt động"
        activateOrExtendAccount={activateOrExtendAccount}
        expireAccount={expireAccount}
        removeAccount={removeAccount}
      />
      <AccountTable
        title="Hết hạn"
        rows={expiredAccounts}
        emptyText="Không có tài khoản hết hạn"
        activateOrExtendAccount={activateOrExtendAccount}
        expireAccount={expireAccount}
        removeAccount={removeAccount}
      />
    </section>
  );
}

function AccountTable({
  title,
  rows,
  emptyText,
  activateOrExtendAccount,
  expireAccount,
  removeAccount,
}: {
  title: string;
  rows: AccountRecord[];
  emptyText: string;
  activateOrExtendAccount: (accountId: string) => void | Promise<void>;
  expireAccount: (accountId: string) => void | Promise<void>;
  removeAccount: (accountId: string) => void | Promise<void>;
}) {
  return (
    <div className="license-table-block">
      <h3>{title}</h3>
      <div className="table-scroll compact-table-scroll">
        <table className="license-table">
          <thead>
            <tr>
              <th>Gmail</th>
              <th>Tên</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Xác thực Gmail</th>
              <th>Kích hoạt</th>
              <th>Hết hạn</th>
              <th>Còn lại</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((account) => (
                <tr key={account.id}>
                  <td className="account-email-cell">{account.email}</td>
                  <td>{account.displayName || "Chưa ghi"}</td>
                  <td>{getAccountStateLabel(getAccountState(account))}</td>
                  <td>{formatDateTime(account.createdAt)}</td>
                  <td>{formatDateTime(account.emailVerifiedAt)}</td>
                  <td>{formatDateTime(account.activatedAt)}</td>
                  <td>{formatDateTime(account.expiresAt)}</td>
                  <td className="right">
                    {account.expiresAt
                      ? `${formatNumber(getAccountDaysLeft(account))} ngày`
                      : "Chưa có"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="mini-icon-button"
                        type="button"
                        title="Kích hoạt hoặc gia hạn"
                        onClick={() => activateOrExtendAccount(account.id)}
                        disabled={!account.emailVerifiedAt}
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        className="mini-icon-button"
                        type="button"
                        title="Dừng quyền truy cập"
                        onClick={() => expireAccount(account.id)}
                      >
                        <Lock size={15} />
                      </button>
                      <button
                        className="mini-icon-button danger"
                        type="button"
                        title="Xóa tài khoản"
                        onClick={() => removeAccount(account.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-cell" colSpan={9}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Tất cả</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChartPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="chart-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="segmented-control">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function readInitialPerformanceSheetUrl() {
  if (typeof window === "undefined") return PERFORMANCE_CSV_URL;
  return (
    window.localStorage.getItem(PERFORMANCE_SHEET_URL_STORAGE_KEY)?.trim() ||
    window.localStorage.getItem(LEGACY_SHEET_URL_STORAGE_KEY)?.trim() ||
    PERFORMANCE_CSV_URL
  );
}

function readInitialPhoneSheetUrl() {
  if (typeof window === "undefined") return PHONE_CSV_URL;
  return (
    window.localStorage.getItem(PHONE_SHEET_URL_STORAGE_KEY)?.trim() ||
    PHONE_CSV_URL
  );
}

function accountFromFirestoreDoc(id: string, data: DocumentData): AccountRecord {
  return {
    id,
    email: normalizeEmail(readString(data.email)),
    displayName: readString(data.displayName) || readString(data.email),
    role: data.role === "admin" ? "admin" : "user",
    createdAt: readString(data.createdAt) || new Date().toISOString(),
    emailVerifiedAt: readOptionalString(data.emailVerifiedAt),
    activatedAt: readOptionalString(data.activatedAt),
    expiresAt: readOptionalString(data.expiresAt),
    note: readOptionalString(data.note),
  };
}

function mergeAccountRecord(
  accounts: AccountRecord[],
  nextAccount: AccountRecord,
) {
  const existingIndex = accounts.findIndex(
    (account) => account.id === nextAccount.id,
  );
  if (existingIndex === -1) return [nextAccount, ...accounts];

  return accounts.map((account, index) =>
    index === existingIndex ? nextAccount : account,
  );
}

async function createOrUpdateFirebaseAccountProfile(
  user: User,
  displayNameOverride?: string,
) {
  if (!firebaseServices || !user.email) return;

  const now = new Date().toISOString();
  const email = normalizeEmail(user.email);
  const isAdminEmail = email === normalizeEmail(ADMIN_EMAIL);
  const accountRef = doc(
    firebaseServices.db,
    FIRESTORE_ACCOUNTS_COLLECTION,
    user.uid,
  );

  await setDoc(
    accountRef,
    {
      email,
      displayName:
        displayNameOverride?.trim() || user.displayName || user.email || email,
      role: isAdminEmail ? "admin" : "user",
      createdAt: now,
      emailVerifiedAt: user.emailVerified ? now : null,
      updatedAt: now,
    },
    { merge: true },
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown) {
  const stringValue = readString(value);
  return stringValue || undefined;
}

function firebaseErrorToMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    const messages: Record<string, string> = {
      "auth/email-already-in-use": "Gmail nay da duoc dang ky.",
      "auth/invalid-email": "Dia chi Gmail khong hop le.",
      "auth/invalid-credential": "Gmail hoac mat khau khong dung.",
      "auth/user-not-found": "Khong tim thay tai khoan voi Gmail nay.",
      "auth/wrong-password": "Mat khau khong dung.",
      "auth/weak-password": "Mat khau qua yeu, nen co it nhat 6 ky tu.",
      "permission-denied":
        "Firebase tu choi quyen truy cap. Hay kiem tra Firestore Rules va quyen admin.",
    };

    return messages[error.code] || error.message;
  }

  return error instanceof Error ? error.message : "Co loi Firebase xay ra.";
}

function readStoredAccounts(): AccountRecord[] {
  const defaultAdmin = createDefaultAdminAccount();

  if (typeof window === "undefined") return [defaultAdmin];

  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [defaultAdmin];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [defaultAdmin];
    const accounts = parsed
      .filter((item) => item && (item.email || item.username))
      .map((item): AccountRecord => ({
        id: String(item.id || createId()),
        email: normalizeEmail(String(item.email || item.username)),
        password: String(item.password || ""),
        displayName: String(item.displayName || item.email || item.username || ""),
        role: item.role === "admin" ? "admin" : "user",
        createdAt: String(item.createdAt || new Date().toISOString()),
        emailVerifiedAt: item.emailVerifiedAt
          ? String(item.emailVerifiedAt)
          : item.role === "admin"
            ? String(item.createdAt || new Date().toISOString())
            : undefined,
        verificationCode: item.verificationCode
          ? String(item.verificationCode)
          : createVerificationCode(),
        passwordResetCode: item.passwordResetCode
          ? String(item.passwordResetCode)
          : undefined,
        passwordResetRequestedAt: item.passwordResetRequestedAt
          ? String(item.passwordResetRequestedAt)
          : undefined,
        activatedAt: item.activatedAt ? String(item.activatedAt) : undefined,
        expiresAt: item.expiresAt ? String(item.expiresAt) : undefined,
        note: item.note ? String(item.note) : "",
      }));

    if (
      !accounts.some(
        (account) => normalizeEmail(account.email) === defaultAdmin.email,
      )
    ) {
      return [
        defaultAdmin,
        ...accounts.filter((account) => account.id !== defaultAdmin.id),
      ];
    }

    return accounts;
  } catch {
    return [defaultAdmin];
  }
}

function saveStoredAccounts(accounts: AccountRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

function createDefaultAdminAccount(): AccountRecord {
  const now = new Date().toISOString();
  return {
    id: "default-admin",
    email: normalizeEmail(ADMIN_EMAIL),
    password: ADMIN_PASSWORD,
    displayName: "Quản trị viên",
    role: "admin",
    createdAt: now,
    emailVerifiedAt: now,
    activatedAt: now,
  };
}

function readCurrentAccountId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(CURRENT_ACCOUNT_STORAGE_KEY) || "";
}

function saveCurrentAccountId(accountId: string) {
  if (typeof window === "undefined") return;

  if (accountId) {
    window.localStorage.setItem(CURRENT_ACCOUNT_STORAGE_KEY, accountId);
  } else {
    window.localStorage.removeItem(CURRENT_ACCOUNT_STORAGE_KEY);
  }
}

function downloadText(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([`\uFEFF${content}`], { type: `${type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, csv: string) {
  downloadText(filename, csv, "text/csv");
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getAccountState(account: AccountRecord): AccountState {
  if (account.role === "admin") return "admin";
  if (!account.emailVerifiedAt) return "pending_email";
  if (!account.expiresAt) return "pending_admin";

  const expiresAt = new Date(account.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return "expired";
  return "active";
}

function getAccountStateLabel(state: AccountState) {
  if (state === "admin") return "Quản trị viên";
  if (state === "pending_email") return "Chờ xác thực Gmail";
  if (state === "pending_admin") return "Chờ admin kích hoạt";
  if (state === "expired") return "Hết hạn";
  return "Đang hoạt động";
}

function getAccountDaysLeft(account: AccountRecord) {
  if (!account.expiresAt) return 0;
  const expiresAt = new Date(account.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000));
}

function createVerificationCode() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => String(byte % 10)).join("");
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isGmailAddress(email: string) {
  return /^[^\s@]+@gmail\.com$/i.test(email);
}

function buildAdminContacts() {
  const contacts: Array<{ label: string; href: string }> = [];

  if (ADMIN_PHONE) {
    contacts.push({ label: `Điện thoại: ${ADMIN_PHONE}`, href: `tel:${ADMIN_PHONE}` });
  }
  if (ADMIN_TELEGRAM) {
    contacts.push({
      label: "Telegram",
      href: ADMIN_TELEGRAM.startsWith("http")
        ? ADMIN_TELEGRAM
        : `https://t.me/${ADMIN_TELEGRAM.replace(/^@/, "")}`,
    });
  }
  if (ADMIN_ZALO) {
    contacts.push({
      label: "Zalo",
      href: ADMIN_ZALO.startsWith("http")
        ? ADMIN_ZALO
        : `https://zalo.me/${ADMIN_ZALO}`,
    });
  }
  if (ADMIN_FACEBOOK) {
    contacts.push({
      label: "Facebook",
      href: ADMIN_FACEBOOK.startsWith("http")
        ? ADMIN_FACEBOOK
        : `https://facebook.com/${ADMIN_FACEBOOK}`,
    });
  }

  return contacts;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatDateTime(value?: string) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

async function fetchCsv(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

function resolveGoogleSheetCsvUrl(url: string) {
  if (!url.includes("docs.google.com/spreadsheets")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const sheetId = parsed.pathname.match(/\/d\/([^/]+)/)?.[1];
    const gidFromHash = parsed.hash.match(/gid=(\d+)/)?.[1];
    const gid = parsed.searchParams.get("gid") || gidFromHash || "0";

    if (sheetId && !parsed.pathname.includes("/pub")) {
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }
  } catch {
    return url;
  }

  return url;
}

function parseDelimitedRows(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  return parsed.data.filter((row) =>
    Object.values(row).some((value) => String(value ?? "").trim()),
  );
}

function parsePerformanceCsvToRecords(csv: string) {
  return parseDelimitedRows(csv).map((row, index) =>
    normalizePerformanceRecord(row, index),
  );
}

function parsePhoneCsvToRecords(csv: string) {
  return parseDelimitedRows(csv).flatMap((row, index) =>
    normalizePhoneRecords(row, index),
  );
}

function normalizePerformanceRecord(
  row: Record<string, string>,
  index: number,
): PerformanceRecord {
  const read = (field: keyof typeof COLUMN_ALIASES) =>
    readAliasedValue(row, COLUMN_ALIASES[field]);
  const parsedDate = parseDateValue(read("date"));
  const adId = cleanLabel(read("adId"), "Chưa xác định");

  return {
    id: `performance-${index}-${adId}`,
    sourceRow: index + 2,
    date: parsedDate.key,
    dateLabel: parsedDate.label,
    page: cleanLabel(read("page"), "Chưa xác định"),
    adAccount: cleanLabel(read("adAccount"), "Chưa xác định"),
    service: cleanLabel(read("service"), "Chưa xác định"),
    spend: parseNumber(read("spend")),
    messages: parseNumber(read("messages")),
    comments: parseNumber(read("comments")),
    phoneCount: parseNumber(read("phoneCount")),
    adId,
  };
}

function normalizePhoneRecords(
  row: Record<string, string>,
  index: number,
): PhoneRecord[] {
  const read = (field: keyof typeof COLUMN_ALIASES) =>
    readAliasedValue(row, COLUMN_ALIASES[field]);
  const phoneRaw = read("phone");
  const parsedDate = parseDateValue(read("date"));
  const phones = splitPhoneValues(phoneRaw);
  const displayPhones =
    phones.length > 0 ? phones : phoneRaw.trim() ? [phoneRaw] : [];

  return displayPhones.map((phone, phoneIndex) => ({
    id: `phone-${index}-${phoneIndex}-${normalizeSearch(phone)}`,
    sourceRow: index + 2,
    date: parsedDate.key,
    dateLabel: parsedDate.label,
    phoneRaw,
    phone,
    normalizedPhone: normalizePhone(phone),
    adId: cleanLabel(read("adId"), "Chưa xác định"),
    adAccount: cleanLabel(read("adAccount"), "Chưa xác định"),
    page: cleanLabel(read("page"), "Chưa xác định"),
    service: cleanLabel(read("service"), "Chưa xác định"),
    gender: normalizeGender(read("gender")),
  }));
}

function readAliasedValue(
  row: Record<string, string>,
  aliases: readonly string[],
) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    normalizeHeader(key),
    value,
  ]);
  const normalizedAliases = aliases.map(normalizeHeader);
  const matched = normalizedEntries.find(([key]) => normalizedAliases.includes(key));
  return String(matched?.[1] ?? "").trim();
}

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanLabel(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeGender(value: string) {
  const normalized = normalizeSearch(value);
  if (!normalized) return "Chưa rõ";
  if (["nu", "female", "f", "woman", "women"].includes(normalized)) return "Nữ";
  if (["nam", "male", "m", "man", "men"].includes(normalized)) return "Nam";
  if (normalized.includes("nu")) return "Nữ";
  if (normalized.includes("nam")) return "Nam";
  return cleanLabel(value, "Khác");
}

function parseNumber(value: string) {
  const cleaned = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    const decimalSeparator =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? "," : ".";
    const groupSeparator = decimalSeparator === "," ? "." : ",";
    normalized = cleaned
      .replace(new RegExp(`\\${groupSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (hasComma) {
    normalized = normalizeSingleSeparatorNumber(cleaned, ",");
  } else if (hasDot) {
    normalized = normalizeSingleSeparatorNumber(cleaned, ".");
  }

  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function normalizeSingleSeparatorNumber(value: string, separator: "," | ".") {
  const parts = value.split(separator);
  if (parts.length > 2) return parts.join("");

  const [whole, decimal = ""] = parts;
  if (decimal.length === 3 && whole.length >= 1) return `${whole}${decimal}`;
  if (decimal.length > 0 && decimal.length <= 2) return `${whole}.${decimal}`;
  return value.replace(separator, "");
}

function parseDateValue(value: string): { key: string; label: string } {
  const trimmed = value.trim();
  if (!trimmed) return { key: "", label: "Chưa có ngày" };

  const parts = trimmed.match(/\d+/g);
  if (parts && parts.length >= 3) {
    const [first, second, third] = parts.map(Number);
    const rawYear = parts[0].length === 4 ? first : third;
    const month = parts[0].length === 4 ? second : second;
    const day = parts[0].length === 4 ? third : first;
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = makeDate(year, month, day);
    if (date) return { key: toDateKey(date), label: formatDateLabel(date) };
  }

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    return { key: toDateKey(date), label: formatDateLabel(date) };
  }

  return { key: "", label: trimmed };
}

function makeDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDateLabel(date: Date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}/${date.getFullYear()}`;
}

function extractPhones(value: string) {
  const matches =
    value.match(/(?:\+?84|0)?[\s.-]?\d(?:[\s.-]?\d){8,10}/g) ?? [];
  const phones = matches
    .map((match) => normalizePhone(match))
    .filter((phone): phone is string => Boolean(phone));
  return Array.from(new Set(phones));
}

function splitPhoneValues(value: string) {
  const normalizedPhones = extractPhones(value);
  if (normalizedPhones.length > 0) return normalizedPhones;

  return value
    .split(/[,;\n|]+/g)
    .map((phone) => phone.trim())
    .filter(Boolean);
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0084")) digits = `0${digits.slice(4)}`;
  if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
  if (digits.length === 9) digits = `0${digits}`;
  if (/^0\d{9,10}$/.test(digits)) return digits;
  return "";
}

function matchesBaseFilters(
  record: Pick<PerformanceRecord | PhoneRecord, "date" | "page" | "adAccount" | "service" | "adId">,
  filters: Filters,
) {
  if (filters.startDate && (!record.date || record.date < filters.startDate)) {
    return false;
  }
  if (filters.endDate && (!record.date || record.date > filters.endDate)) {
    return false;
  }
  if (filters.page && record.page !== filters.page) return false;
  if (filters.adAccount && record.adAccount !== filters.adAccount) return false;
  if (filters.service && record.service !== filters.service) return false;
  if (filters.adId && record.adId !== filters.adId) return false;
  return true;
}

function matchesPerformanceFilters(record: PerformanceRecord, filters: Filters) {
  return matchesBaseFilters(record, filters);
}

function matchesPhoneFilters(record: PhoneRecord, filters: Filters) {
  if (!matchesBaseFilters(record, filters)) return false;
  if (filters.gender && record.gender !== filters.gender) return false;
  return true;
}

function summarizeRecords(
  performanceRecords: PerformanceRecord[],
  phoneRecords: PhoneRecord[],
): MetricSummary {
  const phoneSet = new Set<string>();
  const summary = performanceRecords.reduce(
    (current, record) => {
      current.spend += record.spend;
      current.messages += record.messages;
      current.comments += record.comments;
      current.leads += record.phoneCount;
      return current;
    },
    {
      spend: 0,
      messages: 0,
      comments: 0,
      leads: 0,
      validPhones: 0,
      uniquePhones: 0,
      phonePerMessage: 0,
      costPerMessage: 0,
      costPerLead: 0,
    },
  );

  phoneRecords.forEach((record) => {
    if (!record.normalizedPhone) return;
    phoneSet.add(record.normalizedPhone);
    summary.validPhones += 1;
  });

  summary.uniquePhones = phoneSet.size;
  summary.phonePerMessage = summary.messages ? summary.leads / summary.messages : 0;
  summary.costPerMessage = summary.messages ? summary.spend / summary.messages : 0;
  summary.costPerLead = summary.leads ? summary.spend / summary.leads : 0;
  return summary;
}

function buildTrendData(records: PerformanceRecord[]) {
  const groups = new Map<string, MetricSummary & { label: string }>();

  records.forEach((record) => {
    const key = record.date || "unknown";
    const label = record.date ? record.dateLabel.slice(0, 5) : "Chưa ngày";
    const current =
      groups.get(key) ??
      ({
        label,
        spend: 0,
        messages: 0,
        comments: 0,
        leads: 0,
        validPhones: 0,
        uniquePhones: 0,
        phonePerMessage: 0,
        costPerMessage: 0,
        costPerLead: 0,
      } satisfies MetricSummary & { label: string });

    current.spend += record.spend;
    current.messages += record.messages;
    current.comments += record.comments;
    current.leads += record.phoneCount;
    groups.set(key, current);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

function buildGroupedData(
  records: PerformanceRecord[],
  key: DimensionKey | "adId",
  limit = 8,
  sortBy: TopMetric = "spend",
) {
  const groups = new Map<string, MetricSummary & { name: string }>();

  records.forEach((record) => {
    const groupName = record[key] || "Chưa xác định";
    const current =
      groups.get(groupName) ??
      ({
        name: groupName,
        spend: 0,
        messages: 0,
        comments: 0,
        leads: 0,
        validPhones: 0,
        uniquePhones: 0,
        phonePerMessage: 0,
        costPerMessage: 0,
        costPerLead: 0,
      } satisfies MetricSummary & { name: string });

    current.spend += record.spend;
    current.messages += record.messages;
    current.comments += record.comments;
    current.leads += record.phoneCount;
    groups.set(groupName, current);
  });

  return Array.from(groups.values())
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, limit);
}

function buildGenderData(records: PhoneRecord[]) {
  const groups = new Map<string, { name: string; value: number }>();

  records.forEach((record) => {
    const groupName = record.gender || "Chưa rõ";
    const current = groups.get(groupName) ?? { name: groupName, value: 0 };
    current.value += 1;
    groups.set(groupName, current);
  });

  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
}

function buildPerformanceRows(records: PerformanceRecord[]): PerformanceTableRow[] {
  const groups = new Map<
    string,
    Omit<PerformanceTableRow, "page" | "service" | "adAccount"> & {
      pages: Set<string>;
      services: Set<string>;
      adAccounts: Set<string>;
    }
  >();

  records.forEach((record) => {
    const id = makeGroupId(record.adId);
    const current =
      groups.get(id) ??
      ({
        id,
        adId: record.adId,
        pages: new Set<string>(),
        services: new Set<string>(),
        adAccounts: new Set<string>(),
        spend: 0,
        messages: 0,
        comments: 0,
        phoneCount: 0,
      } satisfies Omit<PerformanceTableRow, "page" | "service" | "adAccount"> & {
        pages: Set<string>;
        services: Set<string>;
        adAccounts: Set<string>;
      });

    current.pages.add(record.page);
    current.services.add(record.service);
    current.adAccounts.add(record.adAccount);
    current.spend += record.spend;
    current.messages += record.messages;
    current.comments += record.comments;
    current.phoneCount += record.phoneCount;
    groups.set(id, current);
  });

  return Array.from(groups.values()).map((row) => ({
    id: row.id,
    adId: row.adId,
    page: joinUniqueSet(row.pages),
    service: joinUniqueSet(row.services),
    adAccount: joinUniqueSet(row.adAccounts),
    spend: row.spend,
    messages: row.messages,
    comments: row.comments,
    phoneCount: row.phoneCount,
  }));
}

function buildPhoneRows(records: PhoneRecord[]): PhoneTableRow[] {
  const groups = new Map<string, PhoneTableRow>();

  records.forEach((record) => {
    if (!record.phone) return;

    const id = makeGroupId(
      record.normalizedPhone || record.phone,
      record.adId,
      record.adAccount,
      record.page,
      record.service,
    );
    const current =
      groups.get(id) ??
      ({
        id,
        phoneList: record.phone,
        adId: record.adId,
        adAccount: record.adAccount,
        page: record.page,
        service: record.service,
      } satisfies PhoneTableRow);

    groups.set(id, current);
  });

  return Array.from(groups.values());
}

function joinUniqueSet(values: Set<string>) {
  return Array.from(values).filter(Boolean).join(", ");
}

function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): PaginationState<T> {
  const resolvedPageSize = PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / resolvedPageSize));
  const resolvedPage = clampInteger(page, 1, pageCount);
  const startIndex = (resolvedPage - 1) * resolvedPageSize;
  const pageRows = rows.slice(startIndex, startIndex + resolvedPageSize);
  const end = Math.min(rows.length, startIndex + pageRows.length);

  return {
    rows: pageRows,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    pageCount,
    total: rows.length,
    start: rows.length > 0 ? startIndex + 1 : 0,
    end,
    isScrollable: resolvedPageSize > 10 && pageRows.length > 10,
  };
}

function makeGroupId(...parts: string[]) {
  return parts.map((part) => normalizeSearch(part)).join("::");
}

function compareTableRows<T extends object, K extends keyof T>(
  a: T,
  b: T,
  key: K,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;
  const aValue = a[key];
  const bValue = b[key];

  if (typeof aValue === "number" && typeof bValue === "number") {
    return (aValue - bValue) * multiplier;
  }

  return String(aValue).localeCompare(String(bValue), "vi") * multiplier;
}

function performanceRowToSearchText(row: PerformanceTableRow) {
  return [
    row.adId,
    row.page,
    row.service,
    row.adAccount,
    row.spend,
    row.messages,
    row.comments,
    row.phoneCount,
  ].join(" ");
}

function phoneRowToSearchText(row: PhoneTableRow) {
  return [
    row.phoneList,
    row.adId,
    row.adAccount,
    row.page,
    row.service,
  ].join(" ");
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

function formatMoney(value: number) {
  return moneyFormatter.format(Math.round(value));
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "percent",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatTooltipValue(value: number, name: string) {
  if (name.toLowerCase().includes("chi")) return formatMoney(value);
  return formatNumber(value);
}

function topMetricLabel(metric: TopMetric) {
  if (metric === "messages") return "Mess";
  if (metric === "spend") return "Chi tiêu";
  return "Lead";
}

export default App;
