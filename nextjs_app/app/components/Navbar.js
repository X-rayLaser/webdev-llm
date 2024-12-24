"use client"
import React, { useState } from 'react';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    return (
        <nav className="bg-gray-100 text-gray-800 p-4 shadow-md sticky top-0 z-10">
            <div className="mx-auto flex justify-between items-center">

                <div className="flex space-x-4 text-sky-900 font-semibold">
                    <a href="/app/chats" className="hover:text-gray-600">Chats</a>
                    <a href="/app/configuration" className="hover:text-gray-600">Configuration</a>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
