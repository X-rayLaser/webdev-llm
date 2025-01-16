"use client"
import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLeftLong, faRightLong } from "@fortawesome/free-solid-svg-icons";

export function Pagination({ totalPages }) {
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const page = searchParams.get("page") || 1;
  const pageNumber = Number(page);


  function buildUrl(pageNo) {
    const params = new URLSearchParams(searchParams);
    params.set("page", pageNo);
    return `${pathName}?${params.toString()}`;
  }

  const prevUrl = buildUrl(pageNumber - 1);
  const nextUrl = buildUrl(pageNumber + 1);

  return (
    <div className="mt-4 flex justify-between items-center">
      <PaginationLink
        disabled={pageNumber === 1}
        href={prevUrl}
        icon={faLeftLong}
      />
      <span>
        Page {pageNumber} of {totalPages}
      </span>
      <PaginationLink
        disabled={pageNumber === totalPages}
        href={nextUrl}
        icon={faRightLong}
      />
    </div>
  );
}


function PaginationLink({ disabled, icon, ...props }) {

  const [ inProgress, setInProgress] = useState(false);
  const extraClasses = disabled ? "border-gray-600 opacity-50 cursor-not-allowed" : 
    "text-green-600 border-green-600 bg-green-100 hover:bg-green-800";
  return (
    <Link
      disabled={disabled || inProgress}
      className={`px-6 py-1 rounded border ${extraClasses}`}
      onClick={e => setInProgress(true)}
      prefetch={true}
      {...props}
    >
      <FontAwesomeIcon icon={icon} />
    </Link>
  );
}