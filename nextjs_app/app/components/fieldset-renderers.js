export function getTopDownRenderer(marginClass) {

    function render(formFields, names, errorMessage, submitButton) {
      const elements = [];
      for (let name of names) {
        elements.push(formFields[name]);
      }

      return (
        <div>
          <div className="flex flex-col justify-evenly gap-4 mb-4">{elements}</div>
          {errorMessage}
          <div>{submitButton}</div>
        </div>
      );
    }

    return render;
}