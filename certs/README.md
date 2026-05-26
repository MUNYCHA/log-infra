# TLS Certificates

Place the office-trusted nginx TLS certificate files here on the deployed server:

```text
fullchain.pem
privkey.pem
```

The certificate must include the server IP address or internal hostname used in
`APP_ORIGIN` as a Subject Alternative Name and must be trusted by employee
browsers. Certificate and key files are excluded from Git.
