export function SubmitButton({ onClick, children, disabled=false }) {
    return (
        <button className="bg-blue-700 px-10 py-2 rounded-md text-white hover:bg-blue-900 disabled:bg-gray-500"
            type="submit"
            disabled={disabled}
            onClick={onClick}>
            Submit
            <span>{children}</span>
        </button>
    );
}


export function ProminentButton({ className, children, ...rest }) {
    return (
        <button className="pl-16 pr-16 pt-4 pb-4 bg-violet-900 hover:bg-violet-950 text-white border-2
                         border-white rounded-md text-lg font-semibold"
                {...rest}>
            {children}
        </button>
    );
}


export function OutlineButton({ className, children, ...rest }) {
    return (
        <button className="px-2 py-2 hover:bg-sky-800 hover:text-white hover:border-violet-800 text-gray-800 border-2
                         border-sky-800 rounded-md text-lg font-semibold"
                {...rest}>
            {children}
        </button>
    );
}


export function ButtonGroup({ children }) {
    return (
        <div className="[&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md *:border-cyan-950 *:border-2
                      [&>*:nth-child(odd)]:border-r-0">
            {children}
        </div>
    );
}


export function DialogButton({ className, children, ...rest }) {
    return (
        <button className="pl-6 pr-6 pt-2 pb-2 bg-cyan-700 text-white hover:bg-cyan-900" {...rest}>
            {children}
        </button>
    );
}