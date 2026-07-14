import type { DesignDocument } from "../../shared/design-document";
import type { ComponentCreationRecipe } from "../../shared/target-module";
import { ComponentWorkshop } from "../library/ComponentWorkshop";
import type { BindingComponentOption } from "../library/ComponentPropertyBindings";
import { ScreenWorkshop } from "./ScreenWorkshop";

export function DocumentDefinitionPanel(props: {
  className?: string;
  document: DesignDocument;
  recipe?: ComponentCreationRecipe;
  catalogComponents: readonly BindingComponentOption[];
  onChange: (document: DesignDocument) => void;
  onEditImplementation: () => void;
}) {
  return props.document.kind === "component" ? (
    <ComponentWorkshop
      className={props.className}
      document={props.document}
      recipe={props.recipe}
      catalogComponents={props.catalogComponents}
      onChange={props.onChange}
      onEditImplementation={props.onEditImplementation}
    />
  ) : (
    <ScreenWorkshop
      className={props.className}
      document={props.document}
      onChange={props.onChange}
      onEditRoot={props.onEditImplementation}
    />
  );
}
