export function getTopDownRenderer(marginClass) {

    function render(formFields, names) {
      const elements = [];
      for (let name of names) {
        elements.push(formFields[name]);
      }

      return (
        <div className="flex flex-col justify-evenly gap-4 mb-4">{elements}</div>
      );
    }

    return render;
}