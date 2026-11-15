import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentProject } from "@/features/projects/project-context";
import { useEbook } from "./api";
import { EbookStepper } from "./components";
import { FramingStep, SubjectStep, SummaryStep, TitleStep } from "./steps/basics";
import { EditorStep } from "./steps/editor-step";
import { ExportStep } from "./steps/export-step";
import { OutlineStep } from "./steps/outline-step";
import { CoverStep, WritingStep } from "./steps/writing-cover-steps";

export function EbookPage() {
  const project = useCurrentProject();
  const ebook = useEbook(project.id);
  const [params, setParams] = useSearchParams();

  if (ebook.isPending) return <Skeleton className="h-64 w-full" />;
  if (ebook.isError) return <p className="text-sm text-destructive">L'ebook n'a pas pu être chargé.</p>;

  const data = ebook.data;
  // The step lives in the database; the URL only says which validated step is being viewed.
  const reached = data?.step ?? 1;
  const requested = Number(params.get("etape"));
  const current = requested >= 1 && requested <= reached ? requested : reached;

  function goTo(step: number) {
    setParams({ etape: String(step) });
    window.scrollTo({ top: 0 });
  }

  const steps = data
    ? [
      <SubjectStep key={1} ebook={data} goTo={goTo} />,
      <TitleStep key={2} ebook={data} goTo={goTo} />,
      <SummaryStep key={3} ebook={data} goTo={goTo} />,
      <FramingStep key={4} ebook={data} goTo={goTo} />,
      <OutlineStep key={5} ebook={data} goTo={goTo} />,
      <WritingStep key={6} ebook={data} goTo={goTo} />,
      <CoverStep key={7} ebook={data} goTo={goTo} />,
      <EditorStep key={8} ebook={data} goTo={goTo} />,
      <ExportStep key={9} ebook={data} goTo={goTo} />,
    ]
    : [<SubjectStep key={1} ebook={null} goTo={goTo} />];

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/projets/${project.id}`} className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> {project.name}
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Ebook</h1>
        {data?.title && <p className="text-sm text-muted-foreground">{data.title}</p>}
      </div>
      <EbookStepper reached={reached} current={current} onSelect={goTo} />
      {steps[current - 1]}
    </div>
  );
}
