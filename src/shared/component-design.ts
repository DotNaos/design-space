import type { ComponentProps, ComponentType, ReactNode } from "react";

export type ComponentDesignValues<Props extends object> = Readonly<Record<string, Readonly<Partial<Props>>>>;

export type ComponentDesignPreviewLength = number | string;

export interface ComponentDesignPreview {
  /**
   * CSS color used behind the isolated component without changing the component.
   */
  background?: string;
  /**
   * Fixed or CSS-sized preview frame dimensions. Numbers are interpreted as px.
   */
  width?: ComponentDesignPreviewLength;
  height?: ComponentDesignPreviewLength;
  minHeight?: ComponentDesignPreviewLength;
  /**
   * Space between the preview frame and the component. Numbers are px.
   */
  padding?: ComponentDesignPreviewLength;
  /**
   * Placement of the rendered component inside its preview frame.
   */
  layout?: "start" | "center";
}

type ComponentDesignDefaults<Props extends object> = Omit<Props, "slots"> & (
  "slots" extends keyof Props ? { readonly slots?: Partial<Props["slots"]> } : object
);

interface ComponentDesignBase<Component extends ComponentType<any>> {
  defaults: Readonly<ComponentDesignDefaults<ComponentProps<Component>>>;
  preview?: Readonly<ComponentDesignPreview>;
  render: (props: Readonly<ComponentProps<Component>>) => ReactNode;
}

export interface StatelessComponentDesign<Component extends ComponentType<any>>
  extends ComponentDesignBase<Component> {
  isStateful?: false;
  designs: ComponentDesignValues<ComponentProps<Component>> & {
    readonly default: Readonly<Partial<ComponentProps<Component>>>;
  };
}

export interface StatefulComponentDesign<
  Component extends ComponentType<any>,
  States extends ComponentDesignValues<ComponentProps<Component>> = ComponentDesignValues<ComponentProps<Component>>,
>
  extends ComponentDesignBase<Component> {
  isStateful: true;
  initialState: Extract<keyof States, string>;
  states: States;
}

export type ComponentDesignOptions<Component extends ComponentType<any>> =
  | StatelessComponentDesign<Component>
  | StatefulComponentDesign<Component>;

export interface ComponentDesignDefinition<Props extends object = Record<string, unknown>> {
  component: ComponentType<Props>;
  defaults: Readonly<Props>;
  initialCase: string;
  isStateful: boolean;
  cases: ComponentDesignValues<Props>;
  preview?: Readonly<ComponentDesignPreview>;
  render: (props: Readonly<Props>) => ReactNode;
}

/**
 * Binds one colocated preview design to its real component. Prop and slot
 * structure stays compiler-owned; this module supplies preview values only.
 */
export function defineComponentDesign<Component extends ComponentType<any>>(
  component: Component,
  options: StatelessComponentDesign<Component>,
): ComponentDesignDefinition<ComponentProps<Component>>;
export function defineComponentDesign<
  Component extends ComponentType<any>,
  States extends ComponentDesignValues<ComponentProps<Component>>,
>(
  component: Component,
  options: StatefulComponentDesign<Component, States>,
): ComponentDesignDefinition<ComponentProps<Component>>;
export function defineComponentDesign<Component extends ComponentType<any>>(
  component: Component,
  options: ComponentDesignOptions<Component>,
): ComponentDesignDefinition<ComponentProps<Component>> {
  if (options.isStateful) {
    if (!Object.hasOwn(options.states, options.initialState)) {
      throw new Error(`Initial component design state ${options.initialState} is not declared.`);
    }
    return {
      component,
      defaults: options.defaults as Readonly<ComponentProps<Component>>,
      initialCase: options.initialState,
      isStateful: true,
      cases: options.states,
      preview: options.preview,
      render: options.render,
    };
  }
  return {
    component,
    defaults: options.defaults as Readonly<ComponentProps<Component>>,
    initialCase: "default",
    isStateful: false,
    cases: options.designs,
    preview: options.preview,
    render: options.render,
  };
}
