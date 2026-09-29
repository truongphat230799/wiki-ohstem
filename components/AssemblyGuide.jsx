function ToolIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="34"
            height="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
    )
}

export default function AssemblyGuide({
    href,
    title = 'Tài liệu hướng dẫn lắp ráp',
    description = 'Bấm vào nút bên cạnh để mở tài liệu hướng dẫn lắp ráp (HDLR) trực tuyến và lắp theo từng bước.',
    cta = 'Xem hướng dẫn lắp ráp',
    links = [],
}) {
    return (
        <aside className="ohs-hdlr">
            <div className="ohs-hdlr__main">
                <span className="ohs-hdlr__icon">
                    <ToolIcon />
                </span>
                <div className="ohs-hdlr__body">
                    <span className="ohs-hdlr__badge">Hướng dẫn lắp ráp</span>
                    <p className="ohs-hdlr__title">{title}</p>
                    <p className="ohs-hdlr__desc">{description}</p>
                </div>
                <a
                    className="ohs-hdlr__cta"
                    href={href}
                    target="_blank"
                    rel="noopener"
                >
                    {cta}
                    <span aria-hidden="true">→</span>
                </a>
            </div>
            {links.length > 0 && (
                <div className="ohs-hdlr__more">
                    <span className="ohs-hdlr__more-label">Tài liệu bổ sung:</span>
                    {links.map((link) => (
                        <a
                            key={link.href}
                            className="ohs-hdlr__chip"
                            href={link.href}
                            target="_blank"
                            rel="noopener"
                        >
                            {link.label}
                            <span aria-hidden="true">↗</span>
                        </a>
                    ))}
                </div>
            )}
        </aside>
    )
}
