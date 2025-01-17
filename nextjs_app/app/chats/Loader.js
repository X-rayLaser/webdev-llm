import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';


export default function Loader() {
    return (
        <div className="mt-12">
            <div className="text-3xl text-center text-blue-800 font-semibold">
                <span>Loading... </span>
                <span><FontAwesomeIcon icon={faSpinner} spin size="lg"/></span>
            </div>
        </div>
    );
}
  