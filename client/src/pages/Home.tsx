import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { catalogCategoryLabels } from "@shared/catalogSeed";
import {
  CheckCircle2,
  ChevronDown,
  CircleMinus,
  CirclePlus,
  ClipboardList,
  Loader2,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Wine,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Category = keyof typeof catalogCategoryLabels;
type CartItem = {
  productId: number;
  name: string;
  priceCents: number;
  quantity: number;
};

type CompletedOrder = {
  orderCode: string;
  customerName: string;
  tableNumber: string;
  serviceChargeEnabled: boolean;
  subtotalCents: number;
  serviceChargeCents: number;
  totalCents: number;
  items: Array<{ productName: string; quantity: number; unitPriceCents: number; totalCents: number }>;
};

const categories = Object.entries(catalogCategoryLabels) as [Category, string][];

function currency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category | "todos">("todos");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serviceCharge, setServiceCharge] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<CompletedOrder | null>(null);

  const menuInput = useMemo(
    () => ({
      ...(activeCategory !== "todos" ? { category: activeCategory } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [activeCategory, search],
  );
  const { data: products, isLoading, error } = trpc.menu.list.useQuery(menuInput);
  const { data: counts } = trpc.menu.counts.useQuery();
  const finalizeOrder = trpc.orders.create.useMutation({
    onSuccess: order => {
      setCompletedOrder(order);
      setCart([]);
      setIsCartOpen(false);
      toast.success(`Pedido ${order.orderCode} enviado com sucesso.`);
    },
    onError: result => toast.error(result.message || "Não foi possível finalizar o pedido."),
  });

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const serviceFee = serviceCharge ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal + serviceFee;

  function addToCart(product: { id: number; name: string; priceCents: number }) {
    setCart(current => {
      const alreadyInCart = current.find(item => item.productId === product.id);
      if (alreadyInCart) {
        return current.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { productId: product.id, name: product.name, priceCents: product.priceCents, quantity: 1 }];
    });
    toast.success(`${product.name} adicionado ao pedido.`);
  }

  function changeQuantity(productId: number, difference: number) {
    setCart(current =>
      current
        .map(item => (item.productId === productId ? { ...item, quantity: item.quantity + difference } : item))
        .filter(item => item.quantity > 0),
    );
  }

  function removeItem(productId: number) {
    setCart(current => current.filter(item => item.productId !== productId));
  }

  function submitOrder() {
    if (!cart.length) return toast.error("Adicione produtos antes de finalizar.");
    if (!customerName.trim()) return toast.error("Informe o nome do cliente.");
    if (!tableNumber.trim()) return toast.error("Informe o número da mesa.");

    finalizeOrder.mutate({
      customerName,
      tableNumber,
      serviceChargeEnabled: serviceCharge,
      items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })),
    });
  }

  function startNewOrder() {
    setCompletedOrder(null);
    setCustomerName("");
    setTableNumber("");
    setServiceCharge(true);
    setCart([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const cartContent = (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Seu carrinho</p>
          <h2 className="mt-0.5 font-serif text-2xl font-bold">Meu pedido</h2>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
          onClick={() => setIsCartOpen(false)}
          aria-label="Fechar pedido">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {!cart.length ? (
          <div className="flex h-full min-h-52 flex-col items-center justify-center text-center">
            <div className="rounded-full bg-secondary p-4 text-primary"><ShoppingBag className="h-6 w-6" /></div>
            <p className="mt-4 font-semibold">Seu pedido está vazio</p>
            <p className="mt-1 max-w-52 text-sm leading-5 text-muted-foreground">Escolha seus pratos favoritos no cardápio.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map(item => (
              <div key={item.productId} className="border-b border-border pb-4 last:border-0">
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{currency(item.priceCents)} cada</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold">{currency(item.priceCents * item.quantity)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
                    <button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => changeQuantity(item.productId, -1)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                    <button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => changeQuantity(item.productId, 1)} className="rounded-md p-1.5 text-primary hover:bg-secondary"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                  <button type="button" onClick={() => removeItem(item.productId)} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-red-50 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remover</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border bg-[#fbf7ef] px-5 py-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Dados para finalizar</label>
          <Input value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Nome do cliente" className="col-span-2 h-10 bg-card" />
          <Input value={tableNumber} onChange={event => setTableNumber(event.target.value)} placeholder="Nº da mesa" className="h-10 bg-card" />
          <div className="flex items-center rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground"><ClipboardList className="mr-1.5 h-3.5 w-3.5 text-primary" /> Atendimento na mesa</div>
        </div>

        <div className="mt-5 space-y-2.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="service-charge" className="flex cursor-pointer items-center gap-2 text-muted-foreground"><Switch id="service-charge" checked={serviceCharge} onCheckedChange={setServiceCharge} /><span>Serviço opcional (10%)</span></label>
            <span className="font-medium text-foreground">{currency(serviceFee)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-3 font-serif text-xl font-bold"><span>Total</span><span className="text-primary">{currency(total)}</span></div>
        </div>
        <Button onClick={submitOrder} disabled={finalizeOrder.isPending || !cart.length} className="pressable mt-5 h-12 w-full bg-primary text-primary-foreground shadow-[0_7px_18px_rgba(129,58,37,.24)] hover:bg-[#71301e]">
          {finalizeOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          FINALIZAR PEDIDO
        </Button>
      </div>
    </div>
  );

  if (completedOrder) {
    return (
      <main className="min-h-screen bg-[#f5eee2] px-4 py-10 sm:px-8">
        <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-card shadow-[0_24px_70px_rgba(73,46,29,.16)]">
          <div className="relative overflow-hidden bg-[#3c2418] px-7 py-10 text-center text-[#fff8ec] sm:px-12">
            <div className="absolute -left-12 -top-20 h-48 w-48 rounded-full bg-[#c7753f]/25 blur-2xl" />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#e8b775]/50 bg-[#ffffff0d]"><CheckCircle2 className="h-7 w-7 text-[#f2bd6f]" /></div>
            <p className="relative mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#e5b47b]">Pedido confirmado</p>
            <h1 className="relative mt-2 font-serif text-4xl font-bold">Bom apetite!</h1>
            <p className="relative mt-3 text-sm text-[#f6ddbe]">Seu pedido foi enviado para a cozinha.</p>
          </div>
          <div className="px-7 py-7 sm:px-12 sm:py-9">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-border pb-6">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Cliente</p><p className="mt-1 text-lg font-bold">{completedOrder.customerName}</p></div>
              <div className="text-right"><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Mesa</p><p className="mt-1 text-lg font-bold">{completedOrder.tableNumber}</p></div>
              <div className="w-full text-sm text-muted-foreground">Código do pedido: <span className="font-bold text-foreground">{completedOrder.orderCode}</span></div>
            </div>
            <div className="py-6">
              {completedOrder.items.map(item => <div key={`${item.productName}-${item.quantity}`} className="mb-4 flex gap-4 last:mb-0"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">{item.quantity}</span><div className="min-w-0 flex-1"><p className="font-semibold">{item.productName}</p><p className="text-xs text-muted-foreground">{currency(item.unitPriceCents)} por unidade</p></div><p className="font-semibold">{currency(item.totalCents)}</p></div>)}
            </div>
            <div className="space-y-2 border-t border-dashed border-border pt-5 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{currency(completedOrder.subtotalCents)}</span></div><div className="flex justify-between text-muted-foreground"><span>Serviço (10%) {completedOrder.serviceChargeEnabled ? "" : "— não incluído"}</span><span>{currency(completedOrder.serviceChargeCents)}</span></div><div className="mt-3 flex justify-between font-serif text-2xl font-bold"><span>Total</span><span className="text-primary">{currency(completedOrder.totalCents)}</span></div></div>
            <Button onClick={startNewOrder} className="pressable mt-8 h-12 w-full bg-primary text-primary-foreground hover:bg-[#71301e]"><UtensilsCrossed className="mr-2 h-4 w-4" /> Fazer novo pedido</Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-[#ffffff1f] bg-[#3c2418]/95 text-[#fff8ec] backdrop-blur">
        <div className="mx-auto flex h-[4.4rem] max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ecb871]/40 bg-[#ffffff0d]"><UtensilsCrossed className="h-4 w-4 text-[#f1bd6e]" /></span><span className="font-serif text-xl font-bold tracking-tight">Sabor <em className="font-serif font-normal text-[#eab36e]">&</em> Mesa</span></a>
          <div className="hidden items-center gap-1 lg:flex">{categories.map(([key, label]) => <button key={key} type="button" onClick={() => { setActiveCategory(key); document.getElementById("cardapio")?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-md px-3 py-2 text-sm font-medium text-[#f9e5ca]/80 transition hover:bg-white/10 hover:text-white">{label}</button>)}</div>
          <button type="button" onClick={() => setIsCartOpen(true)} className="pressable relative flex items-center gap-2 rounded-lg border border-[#e7b16d]/40 bg-[#ffffff10] px-3 py-2 text-sm font-bold transition hover:bg-[#ffffff1c]"><ShoppingBag className="h-4 w-4 text-[#f1bd6e]" /> <span className="hidden sm:inline">Meu pedido</span>{itemCount > 0 && <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e1a250] px-1 text-[11px] text-[#3c2418]">{itemCount}</span>}</button>
        </div>
      </header>

      <section id="top" className="relative overflow-hidden bg-[#3c2418] pb-16 pt-12 text-[#fff8ec] sm:pb-20 sm:pt-16">
        <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "radial-gradient(circle at 10% 20%, rgba(215,137,70,.25), transparent 28%), radial-gradient(circle at 90% 80%, rgba(230,177,100,.16), transparent 25%)" }} />
        <div className="relative mx-auto grid max-w-[1600px] items-end gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_340px] lg:px-8">
          <div className="max-w-3xl"><div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#eab36e]"><Sparkles className="h-3.5 w-3.5" /> Cozinha contemporânea</div><h1 className="font-serif text-4xl font-bold leading-[1.05] sm:text-6xl">Escolhas que transformam <em className="font-serif font-normal text-[#eab36e]">a mesa.</em></h1><p className="mt-5 max-w-xl text-base leading-7 text-[#f4d8b6] sm:text-lg">Navegue pelo nosso cardápio, monte seu pedido e aproveite cada detalhe da experiência Sabor & Mesa.</p></div>
          <div className="hidden border-l border-[#ffffff1f] pl-8 lg:block"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#eab36e]">Hoje no menu</p><p className="mt-3 font-serif text-3xl font-bold">150 sabores</p><p className="mt-1 text-sm leading-6 text-[#f4d8b6]">Cinco categorias para todos os momentos.</p></div>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
          <button onClick={() => setActiveCategory("todos")} className={`pressable shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeCategory === "todos" ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"}`}>Todos <span className="ml-1 opacity-70">150</span></button>
          {categories.map(([key, label]) => <button key={key} onClick={() => setActiveCategory(key)} className={`pressable shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeCategory === key ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"}`}>{label} <span className="ml-1 opacity-70">{counts?.[key] ?? 30}</span></button>)}
        </div>

        <div id="cardapio" className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section>
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-primary">Cardápio</p><h2 className="mt-1 font-serif text-3xl font-bold">{activeCategory === "todos" ? "Todos os sabores" : catalogCategoryLabels[activeCategory]}</h2></div><div className="relative w-full sm:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar no cardápio" className="h-11 border-border bg-card pl-9 shadow-sm" /></div></div>

            {isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-secondary" />)}</div> : error ? <div className="rounded-2xl border border-destructive/30 bg-red-50 p-6 text-destructive">Não foi possível carregar o cardápio. Atualize a página para tentar novamente.</div> : products?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map(product => <article key={product.id} className="menu-card flex min-h-56 flex-col rounded-2xl border border-border bg-card p-5 shadow-[0_3px_12px_rgba(74,42,27,.04)]"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">{catalogCategoryLabels[product.category]}</span>{product.category === "vinhos" && <Wine className="h-4 w-4 text-[#a66a3f]" />}</div><h3 className="mt-5 font-serif text-xl font-bold leading-tight">{product.name}</h3><p className="mt-2 flex-1 text-sm leading-5 text-muted-foreground">{product.description}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="text-base font-bold text-primary">{currency(product.priceCents)}</span><Button size="sm" onClick={() => addToCart(product)} className="pressable bg-primary text-primary-foreground hover:bg-[#71301e]"><Plus className="mr-1 h-3.5 w-3.5" /> Adicionar</Button></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center"><Search className="mx-auto h-7 w-7 text-muted-foreground" /><h3 className="mt-4 font-serif text-xl font-bold">Nenhum produto encontrado</h3><p className="mt-1 text-sm text-muted-foreground">Tente buscar outro nome ou selecione outra categoria.</p><Button variant="outline" onClick={() => { setSearch(""); setActiveCategory("todos"); }} className="mt-5">Limpar filtros</Button></div>}
          </section>
          <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-border shadow-[0_10px_30px_rgba(74,42,27,.08)] lg:block">{cartContent}</aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card p-3 shadow-[0_-6px_22px_rgba(74,42,27,.12)] lg:hidden"><Button onClick={() => setIsCartOpen(true)} className="pressable h-12 w-full bg-primary text-primary-foreground hover:bg-[#71301e]"><ShoppingBag className="mr-2 h-4 w-4" /> Ver meu pedido {itemCount ? `(${itemCount})` : ""}<span className="ml-auto font-bold">{currency(total)}</span></Button></div>
      {isCartOpen && <div className="fixed inset-0 z-40 bg-[#2d1a12]/45 lg:hidden"><button type="button" aria-label="Fechar pedido" className="absolute inset-0 h-full w-full cursor-default" onClick={() => setIsCartOpen(false)} /><aside className="absolute bottom-0 right-0 top-0 w-full max-w-md shadow-2xl">{cartContent}</aside></div>}
      <footer className="mb-16 border-t border-border bg-[#fbf7ef] py-8 text-center text-sm text-muted-foreground lg:mb-0"><p className="font-serif text-lg font-bold text-foreground">Sabor <em className="font-normal text-primary">&</em> Mesa</p><p className="mt-1">Cardápio digital · Escolhas feitas para compartilhar.</p></footer>
    </main>
  );
}
