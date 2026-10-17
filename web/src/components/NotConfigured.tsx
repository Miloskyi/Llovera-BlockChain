import { contractsConfigured } from "@/lib/config";

export function NotConfigured() {
  if (contractsConfigured) return null;
  return (
    <div className="panel mb-6 border-warn/50 p-5">
      <p className="font-semibold text-warn">Faltan las direcciones de los contratos</p>
      <p className="mt-1 text-sm text-muted">
        Define <code className="font-data">NEXT_PUBLIC_LLOVERA_ADDRESS</code> y <code className="font-data">NEXT_PUBLIC_USDC_ADDRESS</code> en{" "}
        <code className="font-data">web/.env.local</code>.
      </p>
    </div>
  );
}
