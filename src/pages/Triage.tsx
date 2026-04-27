import TriageChat from '@/components/TriageChat';

const Triage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto">
        <div className="px-4 pt-8 pb-2 text-center">
          <h1 className="font-display text-2xl sm:text-3xl text-foreground mb-1">Find Your Therapist</h1>
          <p className="font-body text-sm text-muted-foreground">
            Have a short conversation with our AI — it takes about 2 minutes and helps us match you to the right person.
          </p>
        </div>
        <div className="flex-1 flex flex-col border border-border rounded-[var(--radius-card)] mx-4 mb-4 mt-4 overflow-hidden shadow-[var(--shadow-soft)] bg-background">
          <TriageChat />
        </div>
      </div>
    </div>
  );
};

export default Triage;
