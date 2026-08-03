
import { Button } from "@heroui/react";

export function ModeButton(props: { active: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return <Button className="min-h-9" size="sm" variant={props.active ? "secondary" : "ghost"} onPress={props.onPress}>{props.icon}{props.label}</Button>;
}
