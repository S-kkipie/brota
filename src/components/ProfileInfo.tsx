import type { ReactNode } from "react";
import { User as UserIcon, MessageCircle, Wallet as WalletIcon, Calendar } from "lucide-react";
import { fmtDate, EXPLORER } from "@/lib/savings";
import type { User, Wallet } from "@/db/schema";

export default function ProfileInfo({
  user,
  wallet,
}: {
  user: User;
  wallet: Wallet | null;
}) {
  const channel = user.telegramChatId
    ? "Telegram"
    : user.whatsappNumber
      ? "WhatsApp"
      : "—";
  const name = user.displayName ?? "Ahorrista";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-xl">
      <h3 className="mb-4 flex items-center text-lg font-semibold">
        <UserIcon className="mr-2 h-5 w-5 text-emerald-400" />
        Tu perfil
      </h3>
      <dl className="space-y-3 text-sm">
        <Row icon={<UserIcon className="h-4 w-4" />} label="Nombre" value={name} />
        <Row icon={<MessageCircle className="h-4 w-4" />} label="Canal" value={channel} />
        <Row
          icon={<WalletIcon className="h-4 w-4" />}
          label="Wallet"
          value={
            wallet ? (
              <a
                href={`${EXPLORER}/account/${wallet.stellarPublicKey}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono hover:text-emerald-400"
              >
                {wallet.stellarPublicKey.slice(0, 6)}…{wallet.stellarPublicKey.slice(-6)}
              </a>
            ) : (
              "—"
            )
          }
        />
        <Row icon={<Calendar className="h-4 w-4" />} label="Desde" value={fmtDate(user.createdAt)} />
      </dl>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-slate-400">
        {icon}
        {label}
      </dt>
      <dd className="text-white">{value}</dd>
    </div>
  );
}
