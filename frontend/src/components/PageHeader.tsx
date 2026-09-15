type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
    </section>
  );
}
