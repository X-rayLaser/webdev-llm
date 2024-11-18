"use client"
import { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBug, faRotateRight } from '@fortawesome/free-solid-svg-icons'


export default function Error({ error, reset }) {
    useEffect(() => {
        console.error(error);
      }, [error]);

    return (
        <main className="flex h-screen flex-col items-center justify-center">
            <header className="text-center text-red-500 text-3xl">
                <div className="text-3xl">
                    <FontAwesomeIcon icon={faBug} size="lg" />
                </div>
                <h2 className="mt-4">Something went wrong!</h2>
            </header>
            <button
                className="mt-4 rounded-md bg-sky-700 px-4 py-2 text-white transition-colors hover:bg-sky-800 text-lg"
                onClick={
                () => reset()
                }
            >
                Try again <span className="ml-2"><FontAwesomeIcon icon={faRotateRight} /></span>
            </button>
        </main>
    );
}