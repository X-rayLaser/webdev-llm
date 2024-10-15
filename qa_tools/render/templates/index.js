import React from 'react';
import ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';

{{ component_definition }}

const root = createRoot(document.getElementById('react_app'));
root.render(
    <{{ component_name }} {{ props_str }} />
);