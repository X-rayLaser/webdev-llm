from jinja2 import Environment, PackageLoader, select_autoescape

env = Environment(
    loader=PackageLoader("render"),
    autoescape=select_autoescape()
)


def render_indexjs(**kwargs):
    template = env.get_template("index.js")
    return template.render(**kwargs)


def render_webpack_config(**kwargs):
    template = env.get_template("webpack.config.js")
    return template.render(**kwargs)
