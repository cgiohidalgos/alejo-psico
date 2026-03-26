import { Mensaje } from "@/stores/useAppStore";

export function ChatBubble({ msg }: { msg: Mensaje }) {
  const isStudent = msg.role === "user";

  return (
    <div
      className={`flex ${isStudent ? "justify-end" : "justify-start"} animate-fade-in`}
    >
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isStudent
            ? "bg-chat-student text-chat-student-foreground rounded-br-md"
            : "bg-chat-patient text-chat-patient-foreground rounded-bl-md"
        }`}
      >
        <p className="text-[11px] font-medium opacity-70 mb-1">
          {isStudent ? "Estudiante" : "Paciente"}
        </p>
        {msg.content}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-chat-patient text-chat-patient-foreground px-4 py-3 rounded-2xl rounded-bl-md">
        <p className="text-[11px] font-medium opacity-70 mb-1">Paciente</p>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-pulse-dot" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-pulse-dot" style={{ animationDelay: "200ms" }} />
          <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-pulse-dot" style={{ animationDelay: "400ms" }} />
        </div>
      </div>
    </div>
  );
}
