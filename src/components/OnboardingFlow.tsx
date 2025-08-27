import React, { useCallback, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { cn } from "../lib/utils";

const RELATIONSHIP_TYPES = [
  "Friend",
  "Partner",
  "Family",
  "Parent",
  "Former Partner",
  "Colleague",
  "School",
] as const;

type Relationship = typeof RELATIONSHIP_TYPES[number];

type StepId =
  | "welcome"
  | "name"
  | "relationship"
  | "memory"
  | "miss"
  | "thankful"
  | "avatar";

type FormData = {
  name: string;
  relationship: Relationship | "";
  memory: string;
  miss: string;
  thankful: string;
};

type Step = {
  id: StepId;
  title: string;
  subtitle?: string;
  component: React.ComponentType<StepProps>;
  validate: (data: FormData) => boolean;
};

type StepProps = {
  data: FormData;
  onChange: (field: keyof FormData, value: string) => void;
  onGenerateAvatar?: () => void;
  avatarUrl?: string | null;
  working?: boolean;
};

// Simplified avatar generation - creates a gradient background with emoji
async function generateSimpleAvatar(seed: string, size = 256): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Simple seeded random
  let seedNum = 0;
  for (let i = 0; i < seed.length; i++) {
    seedNum += seed.charCodeAt(i);
  }
  const rng = () => (Math.sin(seedNum++) * 10000) % 1;

  // Gradient background
  const hue = Math.floor(rng() * 360);
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size);
  grad.addColorStop(0, `hsl(${hue}, 70%, 60%)`);
  grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 35%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Mermaid emoji
  const emoji = rng() > 0.5 ? "🧜‍♀️" : "🧜‍♂️";
  ctx.font = `${size * 0.6}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size/2, size/2);

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob!), "image/png")
  );
}

// Step components
const WelcomeStep: React.FC<StepProps> = () => (
  <div className="text-white/90 leading-relaxed">
    <p>We're honoured you're here to celebrate Emily. This gentle guide will set up your profile while the background settles in.</p>
  </div>
);

const NameStep: React.FC<StepProps> = ({ data, onChange }) => (
  <div className="space-y-3">
    <label className="text-sm text-white/80">Your full name</label>
    <input
      value={data.name}
      onChange={(e) => onChange("name", e.target.value)}
      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-white/50"
      placeholder="Enter your name"
    />
  </div>
);

const RelationshipStep: React.FC<StepProps> = ({ data, onChange }) => (
  <div className="space-y-3">
    <label className="text-sm text-white/80">Select the relationship that best describes you</label>
    <div className="flex flex-wrap gap-2">
      {RELATIONSHIP_TYPES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange("relationship", r)}
          className={cn(
            "px-3 py-1.5 rounded-full border text-sm",
            data.relationship === r
              ? "bg-emerald-500/90 border-emerald-300 text-white"
              : "bg-white/10 border-white/20 text-white/90 hover:bg-white/15"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  </div>
);

const TextAreaStep: React.FC<StepProps & { field: keyof FormData; label: string; placeholder: string; minLength?: number }> =
  ({ data, onChange, field, label, placeholder }) => (
    <div className="space-y-3">
      <label className="text-sm text-white/80">{label}</label>
      <textarea
        value={data[field]}
        onChange={(e) => onChange(field, e.target.value)}
        rows={5}
        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-white/50"
        placeholder={placeholder}
      />
    </div>
  );

const AvatarStep: React.FC<StepProps> = ({ avatarUrl, onGenerateAvatar, working }) => (
  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-6 items-center">
    <div className="order-2 md:order-1">
      <p className="text-white/90 mb-3">
        We've prepared a majestic mermaid portrait as your profile picture. You can regenerate it or keep this one.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onGenerateAvatar}
          className="modern-primary-btn"
          disabled={working}
        >
          {working ? "Generating…" : "Regenerate"}
        </button>
      </div>
    </div>
    <div className="order-1 md:order-2">
      <div className="w-64 h-64 rounded-2xl overflow-hidden bg-black/30 border border-white/20 shadow-lg mx-auto">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Generated mermaid avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/60">No preview yet</div>
        )}
      </div>
    </div>
  </div>
);

// Step configuration
const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Welcome — and thank you for being here.",
    component: WelcomeStep,
    validate: () => true,
  },
  {
    id: "name",
    title: "What is your name?",
    component: NameStep,
    validate: (data) => !!data.name.trim(),
  },
  {
    id: "relationship",
    title: "How did you know Emily?",
    component: RelationshipStep,
    validate: (data) => !!data.relationship,
  },
  {
    id: "memory",
    title: "What is your favourite memory of her?",
    component: (props) => (
      <TextAreaStep {...props} field="memory" label="Share a favourite memory" placeholder="Write a few lines…" minLength={10} />
    ),
    validate: (data) => data.memory.trim().length >= 10,
  },
  {
    id: "miss",
    title: "What do you miss most?",
    component: (props) => (
      <TextAreaStep {...props} field="miss" label="What do you miss most?" placeholder="Write from the heart…" minLength={3} />
    ),
    validate: (data) => data.miss.trim().length >= 3,
  },
  {
    id: "thankful",
    title: "What are you thankful for?",
    component: (props) => (
      <TextAreaStep {...props} field="thankful" label="What are you thankful for?" placeholder="Share your gratitude…" minLength={3} />
    ),
    validate: (data) => data.thankful.trim().length >= 3,
  },
  {
    id: "avatar",
    title: "A majestic mermaid — your profile picture",
    component: AvatarStep,
    validate: () => true, // Avatar is generated automatically
  },
];

export default function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [working, setWorking] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    relationship: "",
    memory: "",
    miss: "",
    thankful: "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);

  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);
  const updateProfile = useMutation(api.profiles.update);
  const updatePicture = useMutation(api.profiles.updatePicture);

  const currentStep = STEPS[stepIndex];
  const isLast = currentStep.id === "avatar";
  const canNext = currentStep.validate(formData) && (!isLast || !!avatarBlob);

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Generate avatar preview
  const handleGenerateAvatar = useCallback(async () => {
    setWorking(true);
    try {
      const seed = [formData.name || "Friend", formData.relationship || "Friend",
                   formData.memory.slice(0, 24), formData.miss.slice(0, 24),
                   formData.thankful.slice(0, 24)].join("|");

      const blob = await generateSimpleAvatar(seed || "emerald-palace");
      const url = URL.createObjectURL(blob);
      if (avatarUrl) URL.revokeObjectURL(avatarUrl);
      setAvatarUrl(url);
      setAvatarBlob(blob);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate an avatar. Please try again.");
    } finally {
      setWorking(false);
    }
  }, [formData, avatarUrl]);

  // Auto-generate avatar when reaching avatar step
  useEffect(() => {
    if (currentStep.id === "avatar" && !avatarBlob && !working) {
      void handleGenerateAvatar();
    }
  }, [currentStep.id, avatarBlob, working, handleGenerateAvatar]);

  const goNext = async () => {
    if (!canNext) return;

    if (currentStep.id !== "avatar") {
      setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
      return;
    }

    // Finalize: ensure profile exists, then upload avatar blob
    if (!formData.name.trim() || !formData.relationship) {
      toast.error("Please provide your name and relationship.");
      setStepIndex(STEPS.findIndex(s => s.id === "name"));
      return;
    }

    if (!avatarBlob) {
      toast.error("Please generate an avatar.");
      return;
    }

    setWorking(true);
    try {
      await updateProfile({
        name: formData.name.trim(),
        relationship: formData.relationship,
      });

      const postUrl = await generateUploadUrl();
      const putRes = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: avatarBlob,
      });

      if (!putRes.ok) throw new Error("Image upload failed");
      const { storageId } = await putRes.json();
      await updatePicture({ storageId });

      toast.success("Welcome — your profile is ready!");
      onComplete();
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong onboarding. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  return (
    <div className="max-w-3xl mx-auto mt-6 p-6 rounded-2xl glass-elevated text-white shadow-lg">
      {/* Progress */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <div
            key={step.id}
            className={cn(
              "h-1.5 rounded-full transition-all flex-1",
              idx <= stepIndex ? "bg-emerald-400" : "bg-white/20"
            )}
            aria-hidden
          />
        ))}
      </div>

      <h1 className="text-2xl font-semibold mb-2">{currentStep.title}</h1>
      {currentStep.subtitle && <p className="text-sm text-white/80 mb-4">{currentStep.subtitle}</p>}

      {/* Dynamic Step Component */}
      <currentStep.component
        data={formData}
        onChange={updateField}
        onGenerateAvatar={() => void handleGenerateAvatar()}
        avatarUrl={avatarUrl}
        working={working}
      />

      {/* Actions */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0 || working}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/90 hover:bg-white/15 disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => void goNext()}
          disabled={!canNext || working}
          className="modern-primary-btn"
        >
          {isLast ? (working ? "Setting up…" : "Finish") : "Next"}
        </button>
      </div>
    </div>
  );
}