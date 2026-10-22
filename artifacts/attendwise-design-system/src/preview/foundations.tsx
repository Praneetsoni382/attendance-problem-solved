import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import referenceImage from '../../docs/references/attendwise-ui-reference.png';
import { Guidelines } from './parts';

const CORE_SWATCHES = [
  { name: 'Primary · Indigo', value: '#303779', className: 'bg-primary' },
  { name: 'Secondary · Violet', value: '#6A6CB4', className: 'bg-secondary' },
  { name: 'Accent · Mint', value: '#73CBA4', className: 'bg-accent' },
] as const;

const SUPPORTING_SWATCHES = [
  { name: 'Background', value: '#F5F6FB', className: 'border bg-background' },
  { name: 'Text', value: '#20243A', className: 'bg-foreground' },
  { name: 'Muted surface', value: '#EFF0F7', className: 'bg-muted' },
  { name: 'Absent / error', value: '#B8424F', className: 'bg-destructive' },
  { name: 'Discrepancy accent', value: '#966018', className: 'bg-chart-4' },
  { name: 'Border', value: '#E3E5F0', className: 'border bg-border' },
] as const;

const TYPE_SCALE = [
  { label: 'Display', className: 'text-4xl font-bold' },
  { label: 'Heading', className: 'text-2xl font-semibold' },
  { label: 'Body', className: 'text-base' },
  { label: 'Label', className: 'text-sm font-medium' },
  { label: 'Caption', className: 'text-sm text-muted-foreground' },
] as const;

const SPACING_SCALE = [
  { label: '4', className: 'w-4' },
  { label: '8', className: 'w-8' },
  { label: '12', className: 'w-12' },
  { label: '16', className: 'w-16' },
  { label: '24', className: 'w-24' },
] as const;

function Swatch({
  name,
  className,
  value,
}: {
  name: string;
  className: string;
  value?: string;
}) {
  return (
    <div className="space-y-2">
      <div className={`h-16 rounded-lg ${className}`} />
      <div>
        <p className="text-sm font-medium">{name}</p>
        {value ? (
          <p className="text-xs text-muted-foreground">{value}</p>
        ) : null}
      </div>
    </div>
  );
}

export function BrandPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border bg-card p-6 text-card-foreground">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Source reference · Multi-screen app UI
          </p>
          <h2 className="mt-2 text-xl font-semibold">The AttendWise direction</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            The supplied reference combines a student dashboard, timetable,
            attendance history, and mobile screens. It anchors the palette,
            rounded surfaces, clear status labels, and compact academic data
            presentation used throughout this system.
          </p>
        </div>
        <img
          src={referenceImage}
          alt="AttendWise multi-screen interface reference showing student attendance, timetable, history, and mobile views"
          className="w-full rounded-lg border bg-background"
        />
        <p className="text-xs text-muted-foreground">
          This is a complete interface reference, not a standalone logo asset.
        </p>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6 text-card-foreground">
        <div>
          <h2 className="font-semibold">Visual usage principles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Guidance drawn from the supplied product brief and interface
            reference.
          </p>
        </div>
        <Guidelines
          items={[
            { kind: 'do', text: 'Use indigo for primary actions, violet for supporting emphasis, and mint for positive attendance states.' },
            { kind: 'do', text: 'Pair status color with a readable label or icon so state is never conveyed by color alone.' },
            { kind: 'do', text: 'Use cool, soft page backgrounds, white or deep surfaces, subtle borders, and restrained shadows.' },
            { kind: 'do', text: 'Keep attendance metrics and class states easy to scan; make mobile navigation and tables adapt to narrow screens.' },
            { kind: 'do', text: 'Use decorative academic illustrations sparingly and keep motion subtle, with reduced-motion support.' },
            { kind: 'dont', text: 'Do not use neon colors, heavy gradients, dense ERP-style tables, or large decorative artwork.' },
            { kind: 'dont', text: 'Do not shrink a desktop timetable or navigation layout to fit mobile; reflow it for touch and readability.' },
            { kind: 'dont', text: 'Do not present an ERP difference as proof that either record is wrong.' },
          ]}
        />
      </section>
    </div>
  );
}

export function OverviewPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-5 text-card-foreground">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            AttendWise · Student attendance
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Clear records. Confident decisions.
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            A friendly academic workspace built around readable attendance
            data, dependable status cues, and a calm indigo-violet palette.
          </p>
        </div>
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Core palette
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 text-card-foreground">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Typography
          </h2>
          <div className="mt-4 space-y-3">
            {TYPE_SCALE.map((entry) => (
              <p key={entry.label} className={entry.className}>
                {entry.label}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 text-card-foreground">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            In use
          </h2>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Data Structures Lab</CardTitle>
              <CardDescription>
                Today · 10:00–11:00 AM IST · Practical
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="overview-target">Attendance target</Label>
                <Input id="overview-target" defaultValue="75%" readOnly />
              </div>
              <div className="flex items-center gap-2">
                <Switch defaultChecked id="overview-notify" />
                <Label htmlFor="overview-notify">Class reminders</Label>
                <Badge className="ml-auto">Demo</Badge>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button>Mark present</Button>
              <Button variant="outline">View details</Button>
            </CardFooter>
          </Card>
        </section>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Attendance interface samples
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary action</Button>
          <Button variant="secondary">Secondary action</Button>
          <Button variant="outline">View history</Button>
          <Button variant="ghost">More details</Button>
          <Badge>Present</Badge>
          <Badge variant="secondary">Practical</Badge>
          <Badge variant="outline">ERP not entered</Badge>
        </div>
      </section>
    </div>
  );
}

export function ColorsPage() {
  return (
      <div className="space-y-8 rounded-xl border bg-card p-6 text-card-foreground">
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Brand colors</h2>
          <p className="text-sm text-muted-foreground">
            The core roles used for emphasis, supporting actions, and accents.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Semantic and surface colors</h2>
          <p className="text-sm text-muted-foreground">
            Roles for text, backgrounds, borders, muted content, and danger.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {SUPPORTING_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function FontsPage() {
  return (
    <div className="space-y-8 rounded-xl border bg-card p-6 text-card-foreground">
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Font family
        </h2>
        <p className="mt-4 text-4xl font-bold">The quick brown fox</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The token font family is applied across this entire preview.
        </p>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Type scale
        </h2>
        {TYPE_SCALE.map((entry) => (
          <div key={entry.label} className="grid gap-2 sm:grid-cols-[88px_1fr]">
            <span className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {entry.label}
            </span>
            <p className={entry.className}>Build products people understand.</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function LayoutPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Spacing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The spacing scale, derived from the base spacing token.
        </p>
        <div className="mt-6 space-y-4">
          {SPACING_SCALE.map((space) => (
            <div key={space.label} className="flex items-center gap-4">
              <span className="w-8 text-xs text-muted-foreground">
                {space.label}
              </span>
              <div className={`h-3 rounded-full bg-primary ${space.className}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Radius</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Corner treatments derive from the base radius token.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[
            { label: 'Small', className: 'rounded-sm' },
            { label: 'Medium', className: 'rounded-md' },
            { label: 'Large', className: 'rounded-lg' },
            { label: 'Extra large', className: 'rounded-xl' },
          ].map((radius) => (
            <div
              key={radius.label}
              className={`flex h-24 items-end border bg-muted p-3 ${radius.className}`}
            >
              <span className="text-xs font-medium">{radius.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
