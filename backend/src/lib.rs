use worker::*;

#[event(fetch)]
async fn fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    Router::new()
        .get("/", |_, _| Response::ok("SharedDiary API"))
        .get("/health", |_, _| {
            let mut response = Response::ok(r#"{"status":"ok"}"#)?;
            response
                .headers_mut()
                .set("Content-Type", "application/json")?;
            Ok(response)
        })
        .run(req, env)
        .await
}
