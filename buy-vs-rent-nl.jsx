import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine
} from "recharts";

// ─── CONSTANTS & DEFAULTS ───────────────────────────────────────────
const DEFAULTS = {
  purchasePrice: 400000,
  downPayment: 40000,
  mortgageRate: 3.8,
  mortgageTerm: 30,
  closingCosts: 2.0,
  overdrachtsbelasting: 2.0,
  propertyTax: 0.1,
  homeInsurance: 1200,
  maintenancePct: 1.0,
  monthlyRent: 1500,
  renterInsurance: 15,
  marginalTaxRate: 37.07,
  capitalGainsTaxRate: 0,
  investmentReturn: 7.0,
  yearsInHome: 30,
  homeAppreciation: 2.5,
  rentIncrease: 3.0,
  eigenwoningforfait: 0.35,
  hypotheekrenteaftrekPct: 37.07,
};

const LABELS = {
  purchasePrice: "Purchase Price",
  downPayment: "Down Payment",
  mortgageRate: "Mortgage Interest Rate",
  mortgageTerm: "Mortgage Term (years)",
  closingCosts: "Closing Costs (notary, etc.)",
  overdrachtsbelasting: "Overdrachtsbelasting",
  propertyTax: "Annual Property Tax (OZB)",
  homeInsurance: "Annual Home Insurance",
  maintenancePct: "Annual Maintenance",
  monthlyRent: "Monthly Rent",
  renterInsurance: "Monthly Renter's Insurance",
  marginalTaxRate: "Marginal Income Tax Rate",
  capitalGainsTaxRate: "Capital Gains Tax (investments)",
  investmentReturn: "Expected Investment Return",
  yearsInHome: "Time Horizon",
  homeAppreciation: "Annual Home Price Appreciation",
  rentIncrease: "Annual Rent Increase",
  eigenwoningforfait: "Eigenwoningforfait Rate",
  hypotheekrenteaftrekPct: "Hypotheekrenteaftrek Tax Rate",
};

const UNITS = {
  purchasePrice: "€", downPayment: "€", mortgageRate: "%",
  mortgageTerm: "yr", closingCosts: "%", overdrachtsbelasting: "%",
  propertyTax: "%", homeInsurance: "€/yr", maintenancePct: "%",
  monthlyRent: "€/mo", renterInsurance: "€/mo", marginalTaxRate: "%",
  capitalGainsTaxRate: "%", investmentReturn: "%", yearsInHome: "yr",
  homeAppreciation: "%", rentIncrease: "%", eigenwoningforfait: "%",
  hypotheekrenteaftrekPct: "%",
};

const TOOLTIPS = {
  purchasePrice: "The total purchase price of the property.",
  downPayment: "Amount paid upfront. In NL, 100% mortgages are possible but a down payment lowers monthly costs.",
  mortgageRate: "Annual mortgage interest rate. NL average is currently around 3.5–4.5%.",
  mortgageTerm: "Duration of the mortgage. Standard in NL is 30 years with annuity repayment.",
  closingCosts: "Notary fees, valuation report (taxatierapport), mortgage advisor, etc. Typically 1–3% of purchase price.",
  overdrachtsbelasting: "Transfer tax: 2% for primary residences (0% for buyers under 35 on homes up to €510,000 in 2025).",
  propertyTax: "OZB (Onroerendezaakbelasting) – municipal property tax, varies by gemeente.",
  homeInsurance: "Opstalverzekering – required by most mortgage lenders.",
  maintenancePct: "Annual upkeep budget. Rule of thumb: 1% of home value per year.",
  monthlyRent: "Current monthly rent (kale huur + servicekosten).",
  renterInsurance: "Inboedelverzekering – contents insurance for renters.",
  marginalTaxRate: "Your income tax bracket rate. Box 1 rates: 36.97% (up to ~€75k) or 49.50%.",
  capitalGainsTaxRate: "NL taxes investment returns in Box 3 (fictitious yield). Set to 0 if below vrijstelling.",
  investmentReturn: "Expected annual return if you invest instead of buying. Historical stock market avg ~7%.",
  yearsInHome: "How many years you plan to stay. Buying becomes better the longer you stay.",
  homeAppreciation: "Expected annual increase in property value. NL long-term average ~2–3%.",
  rentIncrease: "Expected annual rent increase. NL averages 3–4% in recent years.",
  eigenwoningforfait: "Notional rental value added to taxable income. 2025 rate: 0.35% of WOZ value.",
  hypotheekrenteaftrekPct: "Tax rate at which mortgage interest is deductible. Capped at 37.07% in 2025.",
};

const INPUT_GROUPS = [
  {
    title: "Property & Purchase",
    icon: "🏠",
    keys: ["purchasePrice", "downPayment", "closingCosts", "overdrachtsbelasting"],
  },
  {
    title: "Mortgage",
    icon: "🏦",
    keys: ["mortgageRate", "mortgageTerm"],
  },
  {
    title: "Homeowner Costs",
    icon: "🔧",
    keys: ["propertyTax", "homeInsurance", "maintenancePct"],
  },
  {
    title: "Renting",
    icon: "🔑",
    keys: ["monthlyRent", "renterInsurance"],
  },
  {
    title: "Market & Growth",
    icon: "📈",
    keys: ["homeAppreciation", "rentIncrease", "investmentReturn"],
  },
  {
    title: "Tax (Netherlands)",
    icon: "🇳🇱",
    keys: ["marginalTaxRate", "capitalGainsTaxRate", "eigenwoningforfait", "hypotheekrenteaftrekPct"],
  },
  {
    title: "Time Horizon",
    icon: "⏱️",
    keys: ["yearsInHome"],
  },
];

// ─── HELPERS ────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const fmtK = (n) => {
  if (Math.abs(n) >= 1000000) return `€${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(0)}k`;
  return fmt(n);
};
const pct = (n) => `${n.toFixed(2)}%`;

function calculateMonthlyMortgage(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function runModel(inputs) {
  const {
    purchasePrice, downPayment, mortgageRate, mortgageTerm,
    closingCosts, overdrachtsbelasting, propertyTax, homeInsurance,
    maintenancePct, monthlyRent, renterInsurance, marginalTaxRate,
    investmentReturn, yearsInHome, homeAppreciation, rentIncrease,
    eigenwoningforfait, hypotheekrenteaftrekPct, capitalGainsTaxRate,
  } = inputs;

  const loanAmount = purchasePrice - downPayment;
  const totalClosing = purchasePrice * (closingCosts / 100);
  const transferTax = purchasePrice * (overdrachtsbelasting / 100);
  const totalUpfront = downPayment + totalClosing + transferTax;
  const monthlyMortgage = calculateMonthlyMortgage(loanAmount, mortgageRate, mortgageTerm);

  const monthlyRate = mortgageRate / 100 / 12;
  const totalMonths = mortgageTerm * 12;

  let balance = loanAmount;
  const yearlyData = [];
  let buyerNetWorth = -totalUpfront;
  let renterInvestments = totalUpfront;
  let cumulativeBuyCost = totalUpfront;
  let cumulativeRentCost = 0;
  let breakEvenYear = null;

  for (let year = 1; year <= yearsInHome; year++) {
    let yearInterest = 0;
    let yearPrincipal = 0;

    for (let m = 0; m < 12; m++) {
      if (balance > 0) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = Math.min(monthlyMortgage - interestPayment, balance);
        yearInterest += interestPayment;
        yearPrincipal += principalPayment;
        balance -= principalPayment;
      }
    }

    const homeValue = purchasePrice * Math.pow(1 + homeAppreciation / 100, year);
    const equity = homeValue - Math.max(balance, 0);

    // NL tax: eigenwoningforfait adds to income, hypotheekrenteaftrek deducts interest
    const ewfIncome = homeValue * (eigenwoningforfait / 100);
    const taxDeduction = yearInterest * (hypotheekrenteaftrekPct / 100);
    const netTaxBenefit = taxDeduction - ewfIncome * (marginalTaxRate / 100);

    const annualPropertyTax = homeValue * (propertyTax / 100);
    const annualMaintenance = homeValue * (maintenancePct / 100);
    const totalBuyAnnual = (monthlyMortgage * 12) + annualPropertyTax + homeInsurance + annualMaintenance - netTaxBenefit;

    const currentRent = monthlyRent * Math.pow(1 + rentIncrease / 100, year - 1);
    const totalRentAnnual = (currentRent + renterInsurance) * 12;

    const monthlySavings = (totalRentAnnual - totalBuyAnnual) / 12;
    
    // Renter invests the upfront amount + any monthly savings if renting is cheaper
    const invReturn = investmentReturn / 100;
    renterInvestments = renterInvestments * (1 + invReturn);
    if (totalBuyAnnual > totalRentAnnual) {
      // Renter saves the difference and invests
      renterInvestments += (totalBuyAnnual - totalRentAnnual);
    }

    // Buyer has equity; if renting was MORE expensive, buyer could invest the difference too
    let buyerExtraInvestments = 0;
    if (year > 1 && yearlyData[year - 2]) {
      buyerExtraInvestments = yearlyData[year - 2].buyerExtraInvestments * (1 + invReturn);
    }
    if (totalRentAnnual > totalBuyAnnual) {
      buyerExtraInvestments += (totalRentAnnual - totalBuyAnnual);
    }

    const buyerTotal = equity + buyerExtraInvestments;
    const renterTotal = renterInvestments;

    // Apply capital gains tax on investment returns for renter (Box 3 NL)
    const renterTaxed = renterTotal * (1 - capitalGainsTaxRate / 100 * 0.3); // simplified Box 3

    cumulativeBuyCost += totalBuyAnnual;
    cumulativeRentCost += totalRentAnnual;

    if (!breakEvenYear && buyerTotal >= renterTotal) {
      breakEvenYear = year;
    }

    yearlyData.push({
      year,
      homeValue,
      equity,
      balance: Math.max(balance, 0),
      yearInterest,
      yearPrincipal,
      netTaxBenefit,
      totalBuyAnnual,
      totalBuyMonthly: totalBuyAnnual / 12,
      totalRentAnnual,
      totalRentMonthly: totalRentAnnual / 12,
      currentRent,
      renterInvestments: renterTotal,
      buyerTotal,
      renterTotal,
      advantage: buyerTotal - renterTotal,
      cumulativeBuyCost,
      cumulativeRentCost,
      buyerExtraInvestments,
      annualPropertyTax,
      annualMaintenance,
    });
  }

  return {
    loanAmount,
    totalUpfront,
    totalClosing,
    transferTax,
    monthlyMortgage,
    yearlyData,
    breakEvenYear,
    finalAdvantage: yearlyData.length > 0 ? yearlyData[yearlyData.length - 1].advantage : 0,
  };
}

// ─── COMPONENTS ─────────────────────────────────────────────────────

function TooltipIcon({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: 6, cursor: "help" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onClick={() => setShow(!show)}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "50%", fontSize: 10, fontWeight: 700,
        background: "var(--muted)", color: "var(--text-secondary)",
      }}>?</span>
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "10px 14px", fontSize: 12, lineHeight: 1.5, width: 260, zIndex: 100,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)", color: "var(--text-primary)",
          pointerEvents: "none",
        }}>{text}</span>
      )}
    </span>
  );
}

function InputField({ name, value, onChange, error }) {
  const unit = UNITS[name];
  const isEuro = unit === "€" || unit === "€/yr" || unit === "€/mo";
  const isPct = unit === "%";
  const isYr = unit === "yr";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
          {LABELS[name]}
        </label>
        {TOOLTIPS[name] && <TooltipIcon text={TOOLTIPS[name]} />}
      </div>
      <div style={{
        display: "flex", alignItems: "center", background: "var(--input-bg)",
        border: `1.5px solid ${error ? "var(--danger)" : "var(--border)"}`,
        borderRadius: 8, overflow: "hidden", transition: "border-color 0.2s",
      }}>
        {isEuro && <span style={{ padding: "0 0 0 12px", fontSize: 14, color: "var(--text-secondary)", fontWeight: 600 }}>€</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          step={isPct ? 0.01 : isYr ? 1 : 100}
          style={{
            flex: 1, border: "none", outline: "none", padding: "10px 12px",
            fontSize: 14, fontWeight: 600, background: "transparent", color: "var(--text-primary)",
            fontFamily: "'DM Mono', monospace", width: "100%",
          }}
        />
        {(isPct || isYr || unit === "€/yr" || unit === "€/mo") && (
          <span style={{ padding: "0 12px 0 0", fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
            {isPct ? "%" : isYr ? "years" : unit === "€/yr" ? "/year" : "/month"}
          </span>
        )}
      </div>
      {error && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 3 }}>{error}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, color, large }) {
  return (
    <div style={{
      background: "var(--card)", borderRadius: 12, padding: large ? "24px 20px" : "18px 16px",
      border: "1px solid var(--border)", flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: large ? 28 : 22, fontWeight: 800, color: color || "var(--text-primary)", fontFamily: "'DM Mono', monospace", lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 24, background: "var(--card)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", background: "none", border: "none", cursor: "pointer",
        fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "inherit",
      }}>
        {title}
        <span style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", fontSize: 12 }}>▼</span>
      </button>
      {open && <div style={{ padding: "0 20px 20px" }}>{children}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "12px 16px", boxShadow: "0 8px 30px rgba(0,0,0,0.15)", maxWidth: 280,
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--text-primary)" }}>Year {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 12, marginBottom: 3 }}>
          <span style={{ color: p.color, fontWeight: 600 }}>{p.name}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: "var(--text-primary)" }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── SCENARIOS ──────────────────────────────────────────────────────
function useScenarios() {
  const [scenarios, setScenarios] = useState([]);
  const save = (name, inputs, results) => {
    setScenarios((prev) => [...prev, { name, inputs: { ...inputs }, results, id: Date.now() }]);
  };
  const remove = (id) => setScenarios((prev) => prev.filter((s) => s.id !== id));
  return { scenarios, save, remove };
}

// ─── MAIN APP ───────────────────────────────────────────────────────
export default function BuyVsRentApp() {
  const [inputs, setInputs] = useState(DEFAULTS);
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [scenarioName, setScenarioName] = useState("");
  const { scenarios, save, remove } = useScenarios();
  const [showHelp, setShowHelp] = useState(false);
  const printRef = useRef();

  const handleChange = useCallback((name, rawValue) => {
    const value = rawValue === "" ? "" : Number(rawValue);
    setInputs((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      if (value === "" || isNaN(value)) next[name] = "Please enter a valid number";
      else if (name === "downPayment" && value > inputs.purchasePrice) next[name] = "Cannot exceed purchase price";
      else if (name === "mortgageRate" && value < 0) next[name] = "Rate cannot be negative";
      else if (name === "yearsInHome" && (value < 1 || value > 50)) next[name] = "Enter 1–50 years";
      return next;
    });
  }, [inputs.purchasePrice]);

  const hasErrors = Object.keys(errors).length > 0 || Object.values(inputs).some((v) => v === "" || isNaN(v));
  const results = hasErrors ? null : runModel(inputs);

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (!results) return;
    let csv = "Year,Home Value,Equity,Mortgage Balance,Buy Monthly,Rent Monthly,Buyer Net Worth,Renter Net Worth,Advantage (Buy)\n";
    results.yearlyData.forEach((d) => {
      csv += `${d.year},${d.homeValue.toFixed(0)},${d.equity.toFixed(0)},${d.balance.toFixed(0)},${d.totalBuyMonthly.toFixed(0)},${d.totalRentMonthly.toFixed(0)},${d.buyerTotal.toFixed(0)},${d.renterTotal.toFixed(0)},${d.advantage.toFixed(0)}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "buy-vs-rent-nl.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "monthly", label: "Monthly Costs" },
    { id: "networth", label: "Net Worth" },
    { id: "equity", label: "Equity" },
    { id: "breakdown", label: "Breakdown" },
    { id: "scenarios", label: "Scenarios" },
  ];

  const colors = {
    buy: "#0066FF",
    rent: "#FF6B35",
    equity: "#00C49F",
    invest: "#8B5CF6",
    advantage: "#10B981",
    danger: "#EF4444",
  };

  return (
    <div style={{
      "--bg": "#F8F7F4",
      "--card": "#FFFFFF",
      "--card-alt": "#F2F0EB",
      "--border": "#E5E2DA",
      "--text-primary": "#1A1A1A",
      "--text-secondary": "#6B6560",
      "--accent": "#0066FF",
      "--accent-light": "#E8F0FE",
      "--success": "#10B981",
      "--success-light": "#ECFDF5",
      "--danger": "#EF4444",
      "--danger-light": "#FEF2F2",
      "--muted": "#F0EDE8",
      "--input-bg": "#FAFAF8",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      background: "var(--bg)",
      color: "var(--text-primary)",
      minHeight: "100vh",
      fontSize: 14,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&family=Fraunces:wght@700;800;900&display=swap" rel="stylesheet" />
      
      <style>{`
        @media print {
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          opacity: 1;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #001A3D 0%, #003380 40%, #0055CC 100%)",
        padding: "40px 24px 32px",
        color: "white",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -60, right: -60, width: 300, height: 300,
          borderRadius: "50%", background: "rgba(255,255,255,0.04)",
        }} />
        <div style={{
          position: "absolute", bottom: -40, left: "30%", width: 200, height: 200,
          borderRadius: "50%", background: "rgba(255,255,255,0.03)",
        }} />
        <div style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", opacity: 0.7, marginBottom: 8 }}>
            🇳🇱 Netherlands Housing Calculator
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 10px",
            fontFamily: "'Fraunces', Georgia, serif",
          }}>
            Kopen of Huren?
          </h1>
          <p style={{ fontSize: 15, opacity: 0.8, maxWidth: 520, lineHeight: 1.6, margin: 0 }}>
            Compare the financial outcomes of buying vs. renting a home, with Dutch tax benefits (hypotheekrenteaftrek, eigenwoningforfait) built in.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={() => setShowHelp(!showHelp)} style={{
              padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)", color: "white", cursor: "pointer",
              fontSize: 13, fontWeight: 600, backdropFilter: "blur(10px)",
            }}>
              {showHelp ? "Hide" : "How it works"} ℹ️
            </button>
            <button onClick={handlePrint} style={{
              padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)", color: "white", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}>
              Print 🖨️
            </button>
            <button onClick={handleExport} style={{
              padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)", color: "white", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}>
              Export CSV 📊
            </button>
          </div>
        </div>
      </div>

      {/* HELP PANEL */}
      {showHelp && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 0" }}>
          <div style={{
            background: "var(--accent-light)", border: "1px solid #C5D9F8", borderRadius: 14,
            padding: "24px 28px", lineHeight: 1.8, fontSize: 13, color: "#1A3A6B",
          }}>
            <strong style={{ fontSize: 15 }}>How this calculator works</strong>
            <div style={{ marginTop: 12 }}>
              This tool models two parallel scenarios over your chosen time horizon: <strong>buying a home with a mortgage</strong> vs. <strong>renting and investing the difference</strong>.
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>For the buyer:</strong> We calculate your annuity mortgage payments, deduct the hypotheekrenteaftrek (mortgage interest deduction), add the eigenwoningforfait (imputed rental income), property tax (OZB), insurance, and maintenance. Your home builds equity as you pay down the mortgage and the property appreciates.
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>For the renter:</strong> The upfront costs you would have spent (down payment + closing costs + transfer tax) are invested instead. When renting is cheaper than buying in a given year, the savings are also invested. Returns compound at your chosen investment rate.
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>The comparison:</strong> Buyer's net worth = home equity + any extra invested savings. Renter's net worth = total investment portfolio. The breakeven year is when buying overtakes renting.
            </div>
            <div style={{ marginTop: 8, fontStyle: "italic", opacity: 0.8 }}>
              Note: This is a simplified model. Real outcomes depend on many factors. Consult a financial advisor for personalized advice. Not financial advice.
            </div>
          </div>
        </div>
      )}

      <div ref={printRef} style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* INPUT SECTION */}
        <Section title="📝 Your Inputs" defaultOpen={true}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 24,
          }}>
            {INPUT_GROUPS.map((group) => (
              <div key={group.title} style={{
                background: "var(--card-alt)", borderRadius: 12, padding: "18px 18px 8px",
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "var(--text-secondary)",
                  marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span>{group.icon}</span> {group.title}
                </div>
                {group.keys.map((key) => (
                  <InputField key={key} name={key} value={inputs[key]} onChange={handleChange} error={errors[key]} />
                ))}
              </div>
            ))}
          </div>
        </Section>

        {hasErrors && (
          <div style={{
            background: "var(--danger-light)", border: "1px solid #FECACA", borderRadius: 12,
            padding: "16px 20px", color: "#991B1B", fontSize: 14, fontWeight: 500, marginBottom: 24,
          }}>
            ⚠️ Please fix the input errors above to see results.
          </div>
        )}

        {results && (
          <>
            {/* SUMMARY CARDS */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard
                label="Breakeven Year"
                value={results.breakEvenYear ? `Year ${results.breakEvenYear}` : "Never*"}
                sub={results.breakEvenYear ? "When buying becomes better" : `Within ${inputs.yearsInHome} years`}
                color={results.breakEvenYear ? colors.success : colors.danger}
                large
              />
              <StatCard
                label={`Net Advantage @ Year ${inputs.yearsInHome}`}
                value={fmt(results.finalAdvantage)}
                sub={results.finalAdvantage >= 0 ? "Buying is better" : "Renting is better"}
                color={results.finalAdvantage >= 0 ? colors.buy : colors.rent}
                large
              />
              <StatCard
                label="Monthly Mortgage"
                value={fmt(results.monthlyMortgage)}
                sub={`On ${fmt(results.loanAmount)} loan`}
                large
              />
              <StatCard
                label="Total Upfront (Buy)"
                value={fmt(results.totalUpfront)}
                sub={`Down payment + ${fmt(results.totalClosing)} closing + ${fmt(results.transferTax)} tax`}
                large
              />
            </div>

            {/* TABS */}
            <div style={{
              display: "flex", gap: 4, marginBottom: 20, overflowX: "auto",
              background: "var(--muted)", borderRadius: 10, padding: 4,
            }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: "10px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.2s",
                    background: activeTab === t.id ? "var(--card)" : "transparent",
                    color: activeTab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                    boxShadow: activeTab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            {activeTab === "overview" && (
              <div>
                <Section title="📊 Net Worth Over Time" defaultOpen>
                  <ResponsiveContainer width="100%" height={380}>
                    <AreaChart data={results.yearlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.buy} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={colors.buy} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="rentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.rent} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={colors.rent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} width={65} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      <Area type="monotone" dataKey="buyerTotal" name="Buyer Net Worth" stroke={colors.buy} fill="url(#buyGrad)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="renterTotal" name="Renter Net Worth" stroke={colors.rent} fill="url(#rentGrad)" strokeWidth={2.5} />
                      {results.breakEvenYear && (
                        <ReferenceLine x={results.breakEvenYear} stroke={colors.success} strokeDasharray="5 5" label={{ value: "Breakeven", fill: colors.success, fontSize: 12 }} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </Section>

                <Section title="💰 Buying Advantage Over Time" defaultOpen>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={results.yearlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} width={65} />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke="var(--text-secondary)" strokeWidth={1.5} />
                      <Bar dataKey="advantage" name="Buy vs Rent Advantage" radius={[3, 3, 0, 0]}
                        fill={colors.buy}
                        // Color each bar based on positive/negative
                        shape={(props) => {
                          const { x, y, width, height, value } = props;
                          return (
                            <rect x={x} y={y} width={width} height={height} rx={3} ry={3}
                              fill={value >= 0 ? colors.buy : colors.rent} opacity={0.85} />
                          );
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                    <span style={{ color: colors.buy }}>■</span> Blue = buying is better &nbsp;
                    <span style={{ color: colors.rent }}>■</span> Orange = renting is better
                  </div>
                </Section>
              </div>
            )}

            {activeTab === "monthly" && (
              <Section title="📅 Monthly Cost Comparison" defaultOpen>
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={results.yearlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} width={65} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line type="monotone" dataKey="totalBuyMonthly" name="Buy (monthly)" stroke={colors.buy} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="totalRentMonthly" name="Rent (monthly)" stroke={colors.rent} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "var(--card-alt)", borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: colors.buy }}>🏠 Buying (Year 1 monthly)</div>
                    <div style={{ fontSize: 13, lineHeight: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Mortgage payment</span><span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(results.monthlyMortgage)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Property tax</span><span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(results.yearlyData[0].annualPropertyTax / 12)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Insurance</span><span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(inputs.homeInsurance / 12)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Maintenance</span><span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(results.yearlyData[0].annualMaintenance / 12)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: colors.success }}>
                        <span>Tax benefit</span><span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>-{fmt(results.yearlyData[0].netTaxBenefit / 12)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid var(--border)", paddingTop: 6, fontWeight: 700 }}>
                        <span>Total</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(results.yearlyData[0].totalBuyMonthly)}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "var(--card-alt)", borderRadius: 10, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: colors.rent }}>🔑 Renting (Year 1 monthly)</div>
                    <div style={{ fontSize: 13, lineHeight: 2 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Monthly rent</span><span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(inputs.monthlyRent)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Renter's insurance</span><span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(inputs.renterInsurance)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1.5px solid var(--border)", paddingTop: 6, fontWeight: 700 }}>
                        <span>Total</span><span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(results.yearlyData[0].totalRentMonthly)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {activeTab === "networth" && (
              <Section title="💎 Net Worth Trajectories" defaultOpen>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={results.yearlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} width={65} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Line type="monotone" dataKey="buyerTotal" name="Buyer Net Worth" stroke={colors.buy} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="renterTotal" name="Renter Investments" stroke={colors.rent} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="equity" name="Home Equity Only" stroke={colors.equity} strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 16, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                  The buyer's net worth includes home equity plus any extra savings invested. The renter's net worth is their total investment portfolio (upfront costs + monthly savings invested). The dashed line shows home equity alone.
                </div>
              </Section>
            )}

            {activeTab === "equity" && (
              <Section title="🏗️ Equity & Mortgage Balance" defaultOpen>
                <ResponsiveContainer width="100%" height={380}>
                  <AreaChart data={results.yearlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.equity} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={colors.equity} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 12 }} width={65} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Area type="monotone" dataKey="homeValue" name="Home Value" stroke="#DDA15E" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                    <Area type="monotone" dataKey="equity" name="Your Equity" stroke={colors.equity} fill="url(#eqGrad)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="balance" name="Remaining Mortgage" stroke={colors.danger} fill="none" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </Section>
            )}

            {activeTab === "breakdown" && (
              <Section title="📋 Year-by-Year Breakdown" defaultOpen>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)" }}>
                        {["Year", "Home Value", "Equity", "Balance", "Buy/mo", "Rent/mo", "Tax Benefit", "Buyer NW", "Renter NW", "Advantage"].map((h) => (
                          <th key={h} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.yearlyData.map((d) => (
                        <tr key={d.year} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 700 }}>{d.year}</td>
                          <td style={{ padding: "8px", textAlign: "right" }}>{fmtK(d.homeValue)}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: colors.equity }}>{fmtK(d.equity)}</td>
                          <td style={{ padding: "8px", textAlign: "right" }}>{fmtK(d.balance)}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: colors.buy }}>{fmt(d.totalBuyMonthly)}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: colors.rent }}>{fmt(d.totalRentMonthly)}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: colors.success }}>{fmt(d.netTaxBenefit)}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{fmtK(d.buyerTotal)}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{fmtK(d.renterTotal)}</td>
                          <td style={{
                            padding: "8px", textAlign: "right", fontWeight: 700,
                            color: d.advantage >= 0 ? colors.buy : colors.rent,
                          }}>{fmtK(d.advantage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {activeTab === "scenarios" && (
              <Section title="🔄 Scenario Comparison" defaultOpen>
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Scenario name</label>
                    <input
                      type="text"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="e.g. Amsterdam flat, 3.5% rate"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: 8,
                        border: "1.5px solid var(--border)", fontSize: 14,
                        background: "var(--input-bg)", color: "var(--text-primary)",
                        fontFamily: "inherit", boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (scenarioName.trim()) {
                        save(scenarioName.trim(), inputs, results);
                        setScenarioName("");
                      }
                    }}
                    style={{
                      padding: "10px 24px", borderRadius: 8, border: "none",
                      background: "var(--accent)", color: "white", cursor: "pointer",
                      fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
                    }}
                  >
                    Save Current
                  </button>
                </div>

                {scenarios.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "40px 20px", color: "var(--text-secondary)",
                    background: "var(--card-alt)", borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                    <div>No saved scenarios yet. Adjust inputs and save different scenarios to compare them side by side.</div>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid var(--border)" }}>
                          {["Scenario", "Price", "Rate", "Rent", "Years", "Breakeven", "Final Advantage", ""].map((h) => (
                            <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scenarios.map((s) => (
                          <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 8px", fontWeight: 700 }}>{s.name}</td>
                            <td style={{ padding: "10px 8px", fontFamily: "'DM Mono', monospace" }}>{fmtK(s.inputs.purchasePrice)}</td>
                            <td style={{ padding: "10px 8px", fontFamily: "'DM Mono', monospace" }}>{s.inputs.mortgageRate}%</td>
                            <td style={{ padding: "10px 8px", fontFamily: "'DM Mono', monospace" }}>{fmt(s.inputs.monthlyRent)}</td>
                            <td style={{ padding: "10px 8px" }}>{s.inputs.yearsInHome}</td>
                            <td style={{ padding: "10px 8px", fontWeight: 700, color: s.results.breakEvenYear ? colors.success : colors.danger }}>
                              {s.results.breakEvenYear ? `Year ${s.results.breakEvenYear}` : "Never"}
                            </td>
                            <td style={{
                              padding: "10px 8px", fontWeight: 700, fontFamily: "'DM Mono', monospace",
                              color: s.results.finalAdvantage >= 0 ? colors.buy : colors.rent,
                            }}>{fmtK(s.results.finalAdvantage)}</td>
                            <td style={{ padding: "10px 8px" }}>
                              <button onClick={() => remove(s.id)} style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--text-secondary)", fontSize: 16,
                              }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            )}

            {/* DISCLAIMER */}
            <div style={{
              marginTop: 32, padding: "20px 24px", background: "var(--card-alt)",
              borderRadius: 12, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8,
              borderLeft: "4px solid var(--border)",
            }}>
              <strong>Disclaimer:</strong> This tool provides estimates for educational purposes only and does not constitute financial advice. Actual costs, tax benefits, and returns will vary. Dutch tax rules change frequently — verify current rates with the Belastingdienst. Consider consulting a financial advisor (financieel adviseur) or mortgage advisor (hypotheekadviseur) for personalized guidance.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
