import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'

export default function Loading() {
    return (
        <div className="flex h-screen flex-col items-center justify-center transition-colors">
            <div className="text-3xl text-center text-green-300 font-semibold">
                <span><FontAwesomeIcon icon={faSpinner} spin size="lg"/></span>
            </div>
        </div>
    );
}