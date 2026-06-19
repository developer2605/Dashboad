import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileDown,
  FilterX,
  Link as LinkIcon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
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
  | "service"
  | "phoneCount";
type TopMetric = "messages" | "leads" | "spend";

interface AdRecord {
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
  phoneRaw: string;
  phones: string[];
  phoneCount: number;
  adId: string;
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
  adId: string;
  adAccount: string;
  phoneList: string;
  phoneCount: number;
  page: string;
  service: string;
}

const CSV_URL = import.meta.env.VITE_SHEET_CSV_URL?.trim();
const SHEET_URL_STORAGE_KEY = "ads-dashboard-sheet-url";
const SHEET_TEMPLATE_FILENAME = "mau-truong-du-lieu-google-sheet.csv";

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
  adId: ["adId", "ad id", "ad_id", "ads id", "id ads", "id quang cao"],
  gender: ["gender", "gioi tinh", "giới tính", "sex"],
} as const;

const SAMPLE_CSV = `ngày,page,tài khoản quảng cáo,dịch vụ,số tiền chi tiêu,số mess,bình luận,số điện thoại,ad id,giới tính
01/06/2026,Page Hà Nội,TKQC 01,IVF,"1.250.000",34,12,0981234567,AD-1001,Nữ
01/06/2026,Page Sài Gòn,TKQC 02,Nha khoa,"860,000",21,8,0912345678,AD-1002,Nam
02/06/2026,Page Hà Nội,TKQC 01,IVF,"1,430,000",42,15,+84981234568,AD-1001,Nữ
02/06/2026,Page Đà Nẵng,TKQC 03,Da liễu,540000,12,4,,AD-1003,Chưa rõ
03/06/2026,Page Sài Gòn,TKQC 02,Nha khoa,"975.000",27,11,0901122334,AD-1004,Nữ
04/06/2026,Page Hà Nội,TKQC 04,Da liễu,1120000,29,9,0934556677,AD-1005,Nam
05/06/2026,Page Đà Nẵng,TKQC 03,IVF,"1.760.000",48,20,0977888999,AD-1006,Nữ
06/06/2026,Page Hà Nội,TKQC 01,Nha khoa,690000,18,7,0888123456,AD-1007,Nam
07/06/2026,Page Sài Gòn,TKQC 02,IVF,"2,120,000",55,24,0912345678,AD-1008,Nữ
08/06/2026,Page Đà Nẵng,TKQC 03,Da liễu,730000,17,6,0845566778,AD-1003,Nữ`;

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

const PERFORMANCE_TABLE_COLUMNS: Array<{
  key: PerformanceSortKey;
  label: string;
  align?: "right";
}> = [
  { key: "page", label: "Page" },
  { key: "service", label: "Dịch vụ" },
  { key: "adId", label: "Ad ID Ads" },
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
  { key: "adId", label: "Ad ID Ads" },
  { key: "adAccount", label: "Tài khoản quảng cáo" },
  { key: "phoneList", label: "Danh sách SĐT" },
  { key: "page", label: "Page" },
  { key: "service", label: "Dịch vụ" },
];

function App() {
  const [records, setRecords] = useState<AdRecord[]>([]);
  const [sheetUrlInput, setSheetUrlInput] = useState(readInitialSheetUrl);
  const [activeSheetUrl, setActiveSheetUrl] = useState(readInitialSheetUrl);
  const [loadState, setLoadState] = useState<LoadState>(() => {
    const initialSheetUrl = readInitialSheetUrl();
    return {
      status: "loading",
      source: initialSheetUrl ? "sheet" : "sample",
      message: "Đang tải dữ liệu",
    };
  });
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [performanceSortKey, setPerformanceSortKey] =
    useState<PerformanceSortKey>("spend");
  const [performanceSortDirection, setPerformanceSortDirection] =
    useState<SortDirection>("desc");
  const [phoneSortKey, setPhoneSortKey] = useState<PhoneSortKey>("adId");
  const [phoneSortDirection, setPhoneSortDirection] =
    useState<SortDirection>("asc");
  const [dimension, setDimension] = useState<DimensionKey>("page");
  const [topMetric, setTopMetric] = useState<TopMetric>("leads");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const sheetUrl = activeSheetUrl.trim();

    async function loadData() {
      setLoadState({
        status: "loading",
        source: sheetUrl ? "sheet" : "sample",
        message: sheetUrl ? "Đang tải Google Sheet" : "Đang dùng dữ liệu mẫu",
      });

      try {
        const csv = sheetUrl
          ? await fetchCsv(resolveGoogleSheetCsvUrl(sheetUrl))
          : SAMPLE_CSV;
        const parsedRecords = parseCsvToRecords(csv);

        if (!cancelled) {
          setRecords(parsedRecords);
          setLoadState({
            status: "ready",
            source: sheetUrl ? "sheet" : "sample",
            message: sheetUrl
              ? `Đã tải ${numberFormatter.format(parsedRecords.length)} dòng`
              : "Chưa có link Google Sheet, đang dùng dữ liệu mẫu",
          });
        }
      } catch (error) {
        if (!cancelled) {
          const fallback = parseCsvToRecords(SAMPLE_CSV);
          setRecords(fallback);
          setLoadState({
            status: "error",
            source: "sample",
            message:
              error instanceof Error
                ? `Không tải được Google Sheet: ${error.message}`
                : "Không tải được Google Sheet",
          });
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [activeSheetUrl, refreshTick]);

  const filterOptions = useMemo(
    () => ({
      pages: uniqueSorted(records.map((record) => record.page)),
      adAccounts: uniqueSorted(records.map((record) => record.adAccount)),
      services: uniqueSorted(records.map((record) => record.service)),
      genders: uniqueSorted(records.map((record) => record.gender)),
      adIds: uniqueSorted(records.map((record) => record.adId)),
    }),
    [records],
  );

  const filteredRecords = useMemo(
    () => records.filter((record) => matchesFilters(record, filters)),
    [records, filters],
  );

  const summary = useMemo(
    () => summarizeRecords(filteredRecords),
    [filteredRecords],
  );

  const trendData = useMemo(
    () => buildTrendData(filteredRecords),
    [filteredRecords],
  );

  const groupedData = useMemo(
    () => buildGroupedData(filteredRecords, dimension),
    [filteredRecords, dimension],
  );

  const genderData = useMemo(
    () => buildGroupedData(filteredRecords, "gender").map((item) => ({
      name: item.name,
      value: item.leads,
    })),
    [filteredRecords],
  );

  const topAdsData = useMemo(
    () => buildGroupedData(filteredRecords, "adId", 10, topMetric),
    [filteredRecords, topMetric],
  );

  const performanceRows = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);
    const rows = buildPerformanceRows(filteredRecords);
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
    filteredRecords,
    performanceSortDirection,
    performanceSortKey,
    searchTerm,
  ]);

  const phoneRows = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);
    const rows = buildPhoneRows(filteredRecords);
    const searchedRows = normalizedSearch
      ? rows.filter((row) =>
          normalizeSearch(phoneRowToSearchText(row)).includes(normalizedSearch),
        )
      : rows;

    return [...searchedRows].sort((a, b) =>
      compareTableRows(a, b, phoneSortKey, phoneSortDirection),
    );
  }, [filteredRecords, phoneSortDirection, phoneSortKey, searchTerm]);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setSearchTerm("");
  }

  function applySheetUrl() {
    const nextUrl = sheetUrlInput.trim();
    const resolvedUrl = nextUrl || CSV_URL || "";

    if (typeof window !== "undefined") {
      if (nextUrl) {
        window.localStorage.setItem(SHEET_URL_STORAGE_KEY, nextUrl);
      } else {
        window.localStorage.removeItem(SHEET_URL_STORAGE_KEY);
      }
    }

    setSheetUrlInput(resolvedUrl);
    setActiveSheetUrl(resolvedUrl);
    setRefreshTick((current) => current + 1);
  }

  function handleSheetUrlKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      applySheetUrl();
    }
  }

  function downloadSheetTemplate() {
    downloadCsv(SHEET_TEMPLATE_FILENAME, SAMPLE_CSV);
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
    setPhoneSortDirection(key === "phoneCount" ? "desc" : "asc");
  }

  function exportPerformanceRows() {
    const csv = Papa.unparse(
      performanceRows.map((row) => ({
        page: row.page,
        service: row.service,
        adId: row.adId,
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
        adId: row.adId,
        adAccount: row.adAccount,
        phoneList: row.phoneList,
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
          <span className={`status-pill status-${loadState.status}`}>
            {loadState.message}
          </span>
          <button
            className="icon-button"
            type="button"
            title="Tải lại dữ liệu"
            onClick={() => setRefreshTick((current) => current + 1)}
          >
            <RefreshCw size={18} />
            <span>Cập nhật</span>
          </button>
        </div>
      </header>

      <section className="source-config" aria-label="Cấu hình nguồn dữ liệu">
        <label className="sheet-url-field">
          Link Google Sheet CSV
          <input
            type="url"
            value={sheetUrlInput}
            onChange={(event) => setSheetUrlInput(event.target.value)}
            onKeyDown={handleSheetUrlKeyDown}
            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
          />
        </label>
        <button
          className="icon-button"
          type="button"
          title="Áp dụng link Google Sheet"
          onClick={applySheetUrl}
        >
          <LinkIcon size={17} />
          <span>Áp dụng link</span>
        </button>
        <button
          className="ghost-button"
          type="button"
          title="Tải mẫu trường dữ liệu"
          onClick={downloadSheetTemplate}
        >
          <FileDown size={17} />
          <span>Tải mẫu trường</span>
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

      {loadState.status === "error" && (
        <div className="error-banner" role="alert">
          {loadState.message}. Dashboard vẫn hiển thị dữ liệu mẫu để kiểm tra giao diện.
        </div>
      )}

      <main>
        <section className="kpi-grid" aria-label="Chỉ số tổng quan">
          <KpiCard label="Tổng chi tiêu" value={formatMoney(summary.spend)} />
          <KpiCard label="Tổng mess" value={formatNumber(summary.messages)} />
          <KpiCard label="Bình luận" value={formatNumber(summary.comments)} />
          <KpiCard label="Lead/SĐT" value={formatNumber(summary.leads)} />
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
            subtitle={`${formatNumber(filteredRecords.length)} dòng sau lọc`}
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
                {formatNumber(filteredRecords.length)} dòng sau lọc
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

          <div className="table-scroll">
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
                  performanceRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.page}</td>
                      <td>{row.service}</td>
                      <td>{row.adId}</td>
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

          <div className="table-scroll">
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
                  phoneRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.adId}</td>
                      <td>{row.adAccount}</td>
                      <td className="phone-list-cell">{row.phoneList}</td>
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
        </section>
      </main>
    </div>
  );
}

const CHART_MARGIN = { top: 12, right: 24, bottom: 8, left: 8 };

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

function readInitialSheetUrl() {
  if (typeof window === "undefined") return CSV_URL || "";
  return (
    window.localStorage.getItem(SHEET_URL_STORAGE_KEY)?.trim() || CSV_URL || ""
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

function parseCsvToRecords(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  return parsed.data
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim()))
    .map((row, index) => normalizeRecord(row, index));
}

function normalizeRecord(row: Record<string, string>, index: number): AdRecord {
  const read = (field: keyof typeof COLUMN_ALIASES) =>
    readAliasedValue(row, COLUMN_ALIASES[field]);
  const phoneRaw = read("phone");
  const phones = extractPhones(phoneRaw);
  const parsedDate = parseDateValue(read("date"));

  return {
    id: `${index}-${read("adId") || read("phone") || "row"}`,
    sourceRow: index + 2,
    date: parsedDate.key,
    dateLabel: parsedDate.label,
    page: cleanLabel(read("page"), "Chưa xác định"),
    adAccount: cleanLabel(read("adAccount"), "Chưa xác định"),
    service: cleanLabel(read("service"), "Chưa xác định"),
    spend: parseNumber(read("spend")),
    messages: parseNumber(read("messages")),
    comments: parseNumber(read("comments")),
    phoneRaw,
    phones,
    phoneCount: phones.length || (phoneRaw.trim() ? 1 : 0),
    adId: cleanLabel(read("adId"), "Chưa xác định"),
    gender: normalizeGender(read("gender")),
  };
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

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0084")) digits = `0${digits.slice(4)}`;
  if (digits.startsWith("84")) digits = `0${digits.slice(2)}`;
  if (digits.length === 9) digits = `0${digits}`;
  if (/^0\d{9,10}$/.test(digits)) return digits;
  return "";
}

function matchesFilters(record: AdRecord, filters: Filters) {
  if (filters.startDate && (!record.date || record.date < filters.startDate)) {
    return false;
  }
  if (filters.endDate && (!record.date || record.date > filters.endDate)) {
    return false;
  }
  if (filters.page && record.page !== filters.page) return false;
  if (filters.adAccount && record.adAccount !== filters.adAccount) return false;
  if (filters.service && record.service !== filters.service) return false;
  if (filters.gender && record.gender !== filters.gender) return false;
  if (filters.adId && record.adId !== filters.adId) return false;
  return true;
}

function summarizeRecords(records: AdRecord[]): MetricSummary {
  const phoneSet = new Set<string>();
  const summary = records.reduce(
    (current, record) => {
      record.phones.forEach((phone) => phoneSet.add(phone));
      current.spend += record.spend;
      current.messages += record.messages;
      current.comments += record.comments;
      current.leads += record.phoneCount;
      current.validPhones += record.phones.length;
      return current;
    },
    {
      spend: 0,
      messages: 0,
      comments: 0,
      leads: 0,
      validPhones: 0,
      uniquePhones: 0,
      costPerMessage: 0,
      costPerLead: 0,
    },
  );

  summary.uniquePhones = phoneSet.size;
  summary.costPerMessage = summary.messages ? summary.spend / summary.messages : 0;
  summary.costPerLead = summary.leads ? summary.spend / summary.leads : 0;
  return summary;
}

function buildTrendData(records: AdRecord[]) {
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
  records: AdRecord[],
  key: DimensionKey | "gender" | "adId",
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
        costPerMessage: 0,
        costPerLead: 0,
      } satisfies MetricSummary & { name: string });

    current.spend += record.spend;
    current.messages += record.messages;
    current.comments += record.comments;
    current.leads += record.phoneCount;
    current.validPhones += record.phones.length;
    groups.set(groupName, current);
  });

  return Array.from(groups.values())
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, limit);
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "vi"),
  );
}

function buildPerformanceRows(records: AdRecord[]): PerformanceTableRow[] {
  const groups = new Map<string, PerformanceTableRow>();

  records.forEach((record) => {
    const id = makeGroupId(
      record.page,
      record.service,
      record.adId,
      record.adAccount,
    );
    const current =
      groups.get(id) ??
      ({
        id,
        page: record.page,
        service: record.service,
        adId: record.adId,
        adAccount: record.adAccount,
        spend: 0,
        messages: 0,
        comments: 0,
        phoneCount: 0,
      } satisfies PerformanceTableRow);

    current.spend += record.spend;
    current.messages += record.messages;
    current.comments += record.comments;
    current.phoneCount += record.phoneCount;
    groups.set(id, current);
  });

  return Array.from(groups.values());
}

function buildPhoneRows(records: AdRecord[]): PhoneTableRow[] {
  const groups = new Map<
    string,
    Omit<PhoneTableRow, "phoneList"> & { phones: Set<string> }
  >();

  records.forEach((record) => {
    const phones = getDisplayPhones(record);
    if (phones.length === 0) return;

    const id = makeGroupId(
      record.adId,
      record.adAccount,
      record.page,
      record.service,
    );
    const current =
      groups.get(id) ??
      ({
        id,
        adId: record.adId,
        adAccount: record.adAccount,
        phoneCount: 0,
        page: record.page,
        service: record.service,
        phones: new Set<string>(),
      } satisfies Omit<PhoneTableRow, "phoneList"> & { phones: Set<string> });

    phones.forEach((phone) => current.phones.add(phone));
    current.phoneCount += record.phoneCount;
    groups.set(id, current);
  });

  return Array.from(groups.values()).map((row) => ({
    id: row.id,
    adId: row.adId,
    adAccount: row.adAccount,
    phoneList: Array.from(row.phones).join(", "),
    phoneCount: row.phoneCount,
    page: row.page,
    service: row.service,
  }));
}

function getDisplayPhones(record: AdRecord) {
  if (record.phones.length > 0) return record.phones;
  const rawPhone = record.phoneRaw.trim();
  return rawPhone ? [rawPhone] : [];
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
    row.page,
    row.service,
    row.adId,
    row.adAccount,
    row.spend,
    row.messages,
    row.comments,
    row.phoneCount,
  ].join(" ");
}

function phoneRowToSearchText(row: PhoneTableRow) {
  return [
    row.adId,
    row.adAccount,
    row.phoneList,
    row.page,
    row.service,
    row.phoneCount,
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
