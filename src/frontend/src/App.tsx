import type { Trip } from "@/backend";
import { FareEstimator } from "@/components/FareEstimator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import {
  useAddTrip,
  useGetProfile,
  useGetTrips,
  useSaveProfile,
} from "@/hooks/useQueries";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Calculator,
  Car,
  Check,
  Clock,
  Copy,
  CreditCard,
  MapPin,
  Moon,
  QrCode,
  Route,
  Share2,
  Sun,
  TrendingUp,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const queryClient = new QueryClient();

// Night = 9 PM to 7 AM
function isNightTime(date = new Date()) {
  const h = date.getHours();
  return h >= 21 || h < 7;
}

function formatTime(ts: bigint) {
  const d = new Date(Number(ts / BigInt(1_000_000)));
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function calculateFare(distance: number, waiting: number, isNight: boolean) {
  const baseFare = 40; // first 2 km
  const extraKm = Math.max(0, distance - 2);
  const ratePerKm = isNight ? 30 : 20;
  const extraCharge = Math.round(extraKm * ratePerKm);
  const waitingCharge = Math.round(waiting * 1); // ₹1/min traffic
  const total = baseFare + extraCharge + waitingCharge;
  return { baseFare, extraCharge, waitingCharge, ratePerKm, total };
}

// ─── UPI QR Modal ────────────────────────────────────────────────────────────
function UpiQrModal({
  open,
  onClose,
  upiId,
  driverName,
}: {
  open: boolean;
  onClose: () => void;
  upiId: string;
  driverName: string;
}) {
  async function handleCopyUpi() {
    try {
      await navigator.clipboard.writeText(upiId);
      toast.success("UPI ID copied!");
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        data-ocid="upi.modal"
        className="max-w-xs p-0 overflow-hidden"
        style={{
          background: "#ffffff",
          border: "none",
          borderRadius: "1rem",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle
            className="text-center text-base font-bold"
            style={{ color: "#111" }}
          >
            Pay via UPI
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-4">
          {/* QR Image */}
          {upiId && (
            <div
              className="rounded-xl overflow-hidden p-2"
              style={{ background: "#fff", border: "2px solid #e5e7eb" }}
            >
              <img
                data-ocid="upi.canvas_target"
                src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(driverName || "Driver")}`)}&size=240x240&margin=2`}
                alt="UPI QR Code"
                width={240}
                height={240}
              />
            </div>
          )}

          {/* Driver Name & UPI */}
          {driverName && (
            <p
              className="font-semibold text-center text-sm"
              style={{ color: "#111" }}
            >
              {driverName}
            </p>
          )}
          <p className="text-xs text-center" style={{ color: "#666" }}>
            {upiId}
          </p>

          {/* Actions */}
          <div className="flex gap-2 w-full">
            <Button
              data-ocid="upi.button"
              variant="outline"
              onClick={handleCopyUpi}
              className="flex-1 text-xs h-9"
              style={{
                borderColor: "#e5e7eb",
                color: "#333",
                background: "#f9fafb",
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Copy UPI ID
            </Button>
            <Button
              data-ocid="upi.close_button"
              onClick={onClose}
              className="flex-1 text-xs h-9"
              style={{
                background: "oklch(0.86 0.18 85)",
                color: "#111",
                border: "none",
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Driver Profile Card ──────────────────────────────────────────────────────
function DriverProfileCard() {
  const { data: profile, isLoading } = useGetProfile();
  const saveProfile = useSaveProfile();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [licence, setLicence] = useState("");
  const [upiId, setUpiId] = useState("");
  const [saved, setSaved] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setPhone(profile.phone || "");
    setLicence(profile.licence || "");
    setUpiId(profile.upi_id || "");
  }, [profile]);

  function handleSave() {
    saveProfile.mutate(
      { name, phone, licence, upi_id: upiId },
      {
        onSuccess: () => {
          setSaved(true);
          toast.success("Driver profile saved!");
          setTimeout(() => setSaved(false), 3000);
        },
        onError: () => toast.error("Failed to save profile."),
      },
    );
  }

  const hasSavedUpi = profile?.upi_id && profile.upi_id.length > 0;

  return (
    <>
      <UpiQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        upiId={upiId || profile?.upi_id || ""}
        driverName={name || profile?.name || "Driver"}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="rounded-xl overflow-hidden"
        style={{
          background: "oklch(0.17 0.018 80)",
          border: "1px solid oklch(0.28 0.02 80)",
        }}
      >
        {/* Card Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid oklch(0.24 0.018 80)" }}
        >
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">
              Driver Profile
            </span>
          </div>
          {hasSavedUpi && (
            <button
              type="button"
              data-ocid="upi.open_modal_button"
              onClick={() => setQrOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              style={{
                background: "oklch(0.22 0.04 85 / 0.8)",
                border: "1px solid oklch(0.86 0.18 85 / 0.35)",
                color: "oklch(0.86 0.18 85)",
              }}
            >
              <QrCode className="w-3 h-3" />
              Show QR
            </button>
          )}
        </div>

        {/* Fields */}
        <div className="px-5 py-5 space-y-4">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="driverName"
                    className="text-xs text-muted-foreground"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="driverName"
                    data-ocid="driver.input"
                    placeholder="Ravi Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-sm bg-background/60 border-border/70"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="driverPhone"
                    className="text-xs text-muted-foreground"
                  >
                    Phone Number
                  </Label>
                  <Input
                    id="driverPhone"
                    data-ocid="driver.phone_input"
                    placeholder="9876543210"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="text-sm bg-background/60 border-border/70"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="driverLicence"
                  className="text-xs text-muted-foreground"
                >
                  Driving Licence Number
                </Label>
                <Input
                  id="driverLicence"
                  data-ocid="driver.licence_input"
                  placeholder="KA01 20230012345"
                  value={licence}
                  onChange={(e) => setLicence(e.target.value)}
                  className="text-sm bg-background/60 border-border/70 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="driverUpi"
                  className="text-xs text-muted-foreground flex items-center gap-1"
                >
                  <CreditCard className="w-3 h-3" />
                  UPI ID
                </Label>
                <Input
                  id="driverUpi"
                  data-ocid="driver.upi_input"
                  placeholder="driver@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="text-sm bg-background/60 border-border/70 font-mono"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  data-ocid="driver.save_button"
                  onClick={handleSave}
                  disabled={saveProfile.isPending}
                  className="flex-1 h-10 font-semibold text-sm"
                  style={{
                    background: "oklch(0.86 0.18 85)",
                    color: "oklch(0.12 0.015 85)",
                    boxShadow: "0 2px 12px oklch(0.86 0.18 85 / 0.25)",
                  }}
                >
                  {saveProfile.isPending ? (
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin mr-2" />
                  ) : null}
                  Save Profile
                </Button>

                <AnimatePresence>
                  {saved && (
                    <motion.div
                      data-ocid="driver.success_state"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                      style={{
                        background: "oklch(0.20 0.06 145 / 0.8)",
                        border: "1px solid oklch(0.45 0.12 145 / 0.5)",
                        color: "oklch(0.72 0.15 145)",
                      }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Saved!
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {upiId && (
                <button
                  type="button"
                  data-ocid="upi.open_modal_button"
                  onClick={() => setQrOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: "oklch(0.20 0.03 80)",
                    border: "1px dashed oklch(0.86 0.18 85 / 0.4)",
                    color: "oklch(0.86 0.18 85 / 0.9)",
                  }}
                >
                  <QrCode className="w-4 h-4" />
                  Show QR Code for Passenger
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Meter Tab Content ────────────────────────────────────────────────────────
function MeterContent({
  prefilledDistance,
  onPrefilledUsed,
}: {
  prefilledDistance: string;
  onPrefilledUsed: () => void;
}) {
  const [distance, setDistance] = useState("");
  const [waiting, setWaiting] = useState("");
  const [isNight, setIsNight] = useState(isNightTime());
  const [nightManual, setNightManual] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculateFare> | null>(
    null,
  );
  const [lastDistance, setLastDistance] = useState(0);
  const [lastWaiting, setLastWaiting] = useState(0);

  const { data: trips, isLoading: tripsLoading } = useGetTrips();
  const addTrip = useAddTrip();

  // Accept prefilled distance from estimator
  useEffect(() => {
    if (prefilledDistance) {
      setDistance(prefilledDistance);
      onPrefilledUsed();
      toast.success(`Distance set to ${prefilledDistance} km from estimator`);
    }
  }, [prefilledDistance, onPrefilledUsed]);

  useEffect(() => {
    if (nightManual) return;
    const interval = setInterval(() => setIsNight(isNightTime()), 60_000);
    return () => clearInterval(interval);
  }, [nightManual]);

  function handleToggleNight() {
    setNightManual(true);
    setIsNight((v) => !v);
  }

  function handleCalculate() {
    const dist = Number.parseFloat(distance);
    const wait = Number.parseFloat(waiting) || 0;
    if (Number.isNaN(dist) || dist < 0) {
      toast.error("Please enter a valid distance.");
      return;
    }
    const fare = calculateFare(dist, wait, isNight);
    setResult(fare);
    setLastDistance(dist);
    setLastWaiting(wait);
    addTrip.mutate({
      distance_km: dist,
      waiting_minutes: wait,
      total_fare: fare.total,
      is_night: isNight,
    });
  }

  async function handleShare() {
    if (!result) return;
    const divider = "─────────────────";
    const rateLabel = isNight ? "Night (₹30/km)" : "Day (₹20/km)";
    const lines = [
      "🛺 Auto Rickshaw Fare — Bangalore",
      `Distance: ${lastDistance} km`,
      lastWaiting > 0 ? `Traffic wait: ${lastWaiting} min` : null,
      rateLabel,
      divider,
      `Base fare (2 km): ₹${result.baseFare}`,
      result.extraCharge > 0 ? `Extra km: ₹${result.extraCharge}` : null,
      result.waitingCharge > 0
        ? `Traffic wait: ₹${result.waitingCharge}`
        : null,
      `TOTAL: ₹${result.total}`,
    ];
    const text = lines.filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Fare summary copied!");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Calculator Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-xl overflow-hidden"
        style={{
          background: "oklch(0.17 0.018 80)",
          border: "1px solid oklch(0.28 0.02 80)",
          boxShadow: "0 4px 24px oklch(0 0 0 / 0.4)",
        }}
      >
        {/* Card Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid oklch(0.24 0.018 80)" }}
        >
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            <span className="font-display font-semibold text-sm text-foreground">
              Fare Calculator
            </span>
          </div>

          {/* Day/Night Toggle */}
          <button
            type="button"
            data-ocid="calculator.toggle"
            onClick={handleToggleNight}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300"
            style={{
              background: isNight
                ? "oklch(0.22 0.06 260 / 0.8)"
                : "oklch(0.75 0.15 85 / 0.2)",
              border: isNight
                ? "1px solid oklch(0.55 0.12 260 / 0.5)"
                : "1px solid oklch(0.86 0.18 85 / 0.4)",
              color: isNight ? "oklch(0.75 0.12 260)" : "oklch(0.86 0.18 85)",
            }}
          >
            {isNight ? (
              <>
                <Moon className="w-3 h-3" /> Night ₹30/km
              </>
            ) : (
              <>
                <Sun className="w-3 h-3" /> Day ₹20/km
              </>
            )}
          </button>
        </div>

        {/* Inputs */}
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="distance"
                className="text-xs text-muted-foreground flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" /> Distance (km)
              </Label>
              <Input
                id="distance"
                data-ocid="calculator.input"
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
                className="font-mono text-base bg-background/60 border-border/70"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="waiting"
                className="text-xs text-muted-foreground flex items-center gap-1"
              >
                <Clock className="w-3 h-3" /> Traffic wait (min)
              </Label>
              <Input
                id="waiting"
                data-ocid="calculator.waiting_input"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={waiting}
                onChange={(e) => setWaiting(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCalculate()}
                className="font-mono text-base bg-background/60 border-border/70"
              />
            </div>
          </div>

          <Button
            data-ocid="calculator.primary_button"
            onClick={handleCalculate}
            className="w-full font-display font-semibold text-sm h-11"
            style={{
              background: "oklch(0.86 0.18 85)",
              color: "oklch(0.12 0.015 85)",
              boxShadow: "0 2px 16px oklch(0.86 0.18 85 / 0.35)",
            }}
          >
            <Zap className="w-4 h-4 mr-1.5" />
            Calculate Fare
          </Button>
        </div>

        {/* Fare Breakdown */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="breakdown"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              data-ocid="calculator.panel"
            >
              <div style={{ borderTop: "1px solid oklch(0.24 0.018 80)" }}>
                {/* Meter Display */}
                <div
                  data-ocid="calculator.success_state"
                  className="meter-panel mx-4 mt-4 rounded-lg p-4"
                >
                  <div className="text-center">
                    <p
                      className="text-xs uppercase tracking-widest mb-1"
                      style={{ color: "oklch(0.86 0.18 85 / 0.6)" }}
                    >
                      Total Fare
                    </p>
                    <motion.p
                      key={result.total}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className="font-mono font-bold meter-glow"
                      style={{
                        fontSize: "clamp(2.5rem, 12vw, 3.5rem)",
                        color: "oklch(0.86 0.18 85)",
                        lineHeight: 1.1,
                      }}
                    >
                      ₹{result.total}
                    </motion.p>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      {isNight ? (
                        <>
                          <Moon
                            className="w-3 h-3"
                            style={{ color: "oklch(0.75 0.12 260)" }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: "oklch(0.75 0.12 260)" }}
                          >
                            Night rate ₹30/km
                          </span>
                        </>
                      ) : (
                        <>
                          <Sun
                            className="w-3 h-3"
                            style={{ color: "oklch(0.86 0.18 85 / 0.7)" }}
                          />
                          <span
                            className="text-xs"
                            style={{ color: "oklch(0.86 0.18 85 / 0.7)" }}
                          >
                            Day rate ₹20/km
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Breakdown Lines */}
                <div className="px-5 py-4 space-y-2">
                  <BreakdownRow
                    label="Base fare (first 2 km)"
                    value={result.baseFare}
                  />
                  {result.extraCharge > 0 && (
                    <BreakdownRow
                      label={`Extra km (${Math.max(0, Number.parseFloat(distance) - 2).toFixed(1)} km × ₹${result.ratePerKm})`}
                      value={result.extraCharge}
                    />
                  )}
                  {result.waitingCharge > 0 && (
                    <BreakdownRow
                      label={`Traffic wait (${waiting} min × ₹1)`}
                      value={result.waitingCharge}
                      highlight
                    />
                  )}
                  <Separator className="my-2 bg-border/50" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      Total
                    </span>
                    <span
                      className="font-mono font-bold text-lg"
                      style={{ color: "oklch(0.86 0.18 85)" }}
                    >
                      ₹{result.total}
                    </span>
                  </div>
                </div>

                {/* Share */}
                <div className="px-5 pb-5">
                  <Button
                    data-ocid="share.button"
                    variant="outline"
                    onClick={handleShare}
                    className="w-full text-sm border-border/60 hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-2" />
                    Copy Fare Summary
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Rate Reference Cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="grid grid-cols-4 gap-2"
      >
        {[
          { label: "Min fare", value: "₹40", sub: "first 2 km" },
          { label: "Day rate", value: "₹20", sub: "7am–9pm" },
          { label: "Night rate", value: "₹30", sub: "9pm–7am" },
          { label: "Traffic", value: "₹1", sub: "per min" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg px-2 py-3 text-center"
            style={{
              background: "oklch(0.17 0.018 80)",
              border: "1px solid oklch(0.24 0.018 80)",
            }}
          >
            <p
              className="font-mono font-bold text-sm"
              style={{ color: "oklch(0.86 0.18 85)" }}
            >
              {item.value}
            </p>
            <p className="text-xs font-medium text-foreground/80 leading-tight">
              {item.label}
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              {item.sub}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Driver Profile */}
      <DriverProfileCard />

      {/* Trip History */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-sm text-foreground">
            Recent Trips
          </h2>
          {trips && trips.length > 0 && (
            <Badge
              variant="secondary"
              className="text-xs px-1.5 py-0"
              style={{
                background: "oklch(0.22 0.018 80)",
                color: "oklch(0.55 0.02 80)",
              }}
            >
              {trips.length}
            </Badge>
          )}
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: "oklch(0.17 0.018 80)",
            border: "1px solid oklch(0.24 0.018 80)",
          }}
        >
          {tripsLoading ? (
            <div
              data-ocid="history.loading_state"
              className="py-10 flex flex-col items-center gap-2"
            >
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">
                Loading trips...
              </span>
            </div>
          ) : !trips || trips.length === 0 ? (
            <div
              data-ocid="history.empty_state"
              className="py-12 flex flex-col items-center gap-2 text-center px-6"
            >
              <span className="text-3xl">🛺</span>
              <p className="text-sm font-medium text-foreground/70">
                No trips yet
              </p>
              <p className="text-xs text-muted-foreground">
                Calculate your first fare to see trip history here
              </p>
            </div>
          ) : (
            <div data-ocid="history.list" className="divide-y divide-border/40">
              {trips.map((trip: Trip, idx: number) => (
                <TripRow
                  key={trip.timestamp.toString()}
                  trip={trip}
                  index={idx + 1}
                />
              ))}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}

// ─── Main App Content ─────────────────────────────────────────────────────────
function AppContent() {
  const [activeTab, setActiveTab] = useState<"estimator" | "meter">(
    "estimator",
  );
  const [prefilledDistance, setPrefilledDistance] = useState("");

  function handleUseDistance(dist: number) {
    setPrefilledDistance(String(dist));
    setActiveTab("meter");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center"
            style={{
              background: "oklch(0.86 0.18 85)",
              boxShadow: "0 0 12px oklch(0.86 0.18 85 / 0.4)",
            }}
          >
            <span className="text-lg">🛺</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-base leading-tight">
              Auto Meter
            </h1>
            <p className="text-muted-foreground text-xs">
              Bangalore Fare Calculator
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: "oklch(0.65 0.18 145)",
              boxShadow: "0 0 6px oklch(0.65 0.18 145 / 0.8)",
            }}
          />
          <span className="text-xs text-muted-foreground">Namma Bengaluru</span>
        </div>
      </header>

      {/* Tab Bar */}
      <div
        className="border-b border-border/40 px-4"
        style={{ background: "oklch(0.14 0.016 82)" }}
      >
        <div className="flex max-w-lg mx-auto">
          <button
            type="button"
            data-ocid="estimator.tab"
            onClick={() => setActiveTab("estimator")}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative"
            style={{
              color:
                activeTab === "estimator"
                  ? "oklch(0.86 0.18 85)"
                  : "oklch(0.55 0.02 80)",
              borderBottom:
                activeTab === "estimator"
                  ? "2px solid oklch(0.86 0.18 85)"
                  : "2px solid transparent",
            }}
          >
            <Route className="w-3.5 h-3.5" />
            Fare Estimator
          </button>
          <button
            type="button"
            data-ocid="meter.tab"
            onClick={() => setActiveTab("meter")}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative"
            style={{
              color:
                activeTab === "meter"
                  ? "oklch(0.86 0.18 85)"
                  : "oklch(0.55 0.02 80)",
              borderBottom:
                activeTab === "meter"
                  ? "2px solid oklch(0.86 0.18 85)"
                  : "2px solid transparent",
            }}
          >
            <Calculator className="w-3.5 h-3.5" />
            Meter
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "estimator" ? (
            <motion.div
              key="estimator"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <FareEstimator onUseDistance={handleUseDistance} />
            </motion.div>
          ) : (
            <motion.div
              key="meter"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <MeterContent
                prefilledDistance={prefilledDistance}
                onPrefilledUsed={() => setPrefilledDistance("")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-border/30 px-4 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/70 hover:text-primary transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </footer>

      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "oklch(0.17 0.018 80)",
            border: "1px solid oklch(0.28 0.02 80)",
            color: "oklch(0.94 0.01 85)",
          },
        }}
      />
    </div>
  );
}

// ─── Shared Sub-Components ────────────────────────────────────────────────────
function BreakdownRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-xs"
        style={{
          color: highlight ? "oklch(0.78 0.14 55)" : "oklch(0.60 0.02 80)",
        }}
      >
        {label}
      </span>
      <span
        className="font-mono text-xs font-medium"
        style={{
          color: highlight ? "oklch(0.78 0.14 55)" : "oklch(0.80 0.01 80)",
        }}
      >
        ₹{value}
      </span>
    </div>
  );
}

function TripRow({ trip, index }: { trip: Trip; index: number }) {
  const extraKm = Math.max(0, trip.distance_km - 2);
  return (
    <motion.div
      data-ocid={`history.item.${index}`}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="px-4 py-3 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-md flex items-center justify-center text-sm shrink-0"
          style={{
            background: trip.is_night
              ? "oklch(0.20 0.05 260)"
              : "oklch(0.22 0.04 85)",
            border: trip.is_night
              ? "1px solid oklch(0.35 0.08 260 / 0.5)"
              : "1px solid oklch(0.40 0.08 85 / 0.4)",
          }}
        >
          {trip.is_night ? "🌙" : "☀️"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {trip.distance_km.toFixed(1)} km
            </span>
            {extraKm > 0 && (
              <span className="text-xs text-muted-foreground">
                +{extraKm.toFixed(1)} extra
              </span>
            )}
            <Badge
              className="text-xs px-1.5 py-0 h-4"
              style={{
                background: trip.is_night
                  ? "oklch(0.25 0.06 260 / 0.6)"
                  : "oklch(0.25 0.05 85 / 0.5)",
                color: trip.is_night
                  ? "oklch(0.75 0.12 260)"
                  : "oklch(0.86 0.18 85 / 0.9)",
                border: trip.is_night
                  ? "1px solid oklch(0.45 0.10 260 / 0.4)"
                  : "1px solid oklch(0.60 0.12 85 / 0.4)",
              }}
            >
              {trip.is_night ? "Night" : "Day"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatTime(trip.timestamp)}
          </p>
        </div>
      </div>
      <span
        className="font-mono font-bold text-base"
        style={{ color: "oklch(0.86 0.18 85)" }}
      >
        ₹{trip.total_fare}
      </span>
    </motion.div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
